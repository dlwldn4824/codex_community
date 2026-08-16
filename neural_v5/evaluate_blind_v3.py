import json
from itertools import product
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, f1_score

from model import FactClassifier

ROLES = ("MEMBER", "ADMIN", "GUEST")
ACTIONS = ("READ", "WRITE")
RELATIONSHIPS = ("OWN_PROFILE", "OTHER_USER")
FIELDS = ("actorRole", "action", "relationship")

TEMPLATES = (
    "A {role} identity {action_phrase} {relation_phrase}.",
    "Evidence indicates {relation_phrase} was {action_participle} by an actor whose role was {role}.",
    "Privilege={role}. The active principal {action_phrase} {relation_phrase}.",
    "The access trace records a {role} principal who {action_phrase} {relation_phrase}.",
    "Under {role} authorization, {relation_phrase} was {action_participle}.",
)
READ_PHRASES = ("perused", "read through", "browsed", "checked", "queried")
WRITE_PHRASES = ("revised", "replaced details in", "made an amendment to", "adjusted", "wrote changes to")
READ_PARTICIPLES = ("perused", "read through", "browsed", "checked", "queried")
WRITE_PARTICIPLES = ("revised", "given replacement details", "amended", "adjusted", "changed")
OWN_PHRASES = (
    "the profile under that same identity",
    "a record belonging to the requester",
    "the requester's account",
    "an account owned by the acting identity",
    "a self-owned user record",
)
OTHER_PHRASES = (
    "a profile under an unrelated identity",
    "a record belonging to a third party",
    "an account not associated with the requester",
    "an account owned by somebody different",
    "an externally owned user record",
)


def build_cases():
    cases = []
    for combination_index, (role, action, relationship) in enumerate(product(ROLES, ACTIONS, RELATIONSHIPS)):
        for variation in range(5):
            action_phrase = (READ_PHRASES if action == "READ" else WRITE_PHRASES)[variation]
            action_participle = (READ_PARTICIPLES if action == "READ" else WRITE_PARTICIPLES)[variation]
            relation_phrase = (OWN_PHRASES if relationship == "OWN_PROFILE" else OTHER_PHRASES)[variation]
            text = TEMPLATES[(combination_index * 2 + variation) % len(TEMPLATES)].format(
                role=role,
                action_phrase=action_phrase,
                action_participle=action_participle,
                relation_phrase=relation_phrase,
            )
            cases.append((text, (role, action, relationship)))
    return cases


def main():
    cases = build_cases()
    model = FactClassifier("artifacts/security-fact-model-v5")
    expected, predicted = {field: [] for field in FIELDS}, {field: [] for field in FIELDS}
    failures = []
    for index, (text, wanted) in enumerate(cases, 1):
        result = model.predict(text)
        actual = tuple(result[field] for field in FIELDS)
        for field, expected_value, predicted_value in zip(FIELDS, wanted, actual, strict=True):
            expected[field].append(expected_value)
            predicted[field].append(predicted_value)
        if actual != wanted:
            failures.append({"case": index, "text": text, "expected": dict(zip(FIELDS, wanted)), "predicted": result})

    exact = float(np.mean([all(expected[field][i] == predicted[field][i] for field in FIELDS) for i in range(len(cases))]))
    field_metrics = {
        field: {
            "accuracy": accuracy_score(expected[field], predicted[field]),
            "macro_f1": f1_score(expected[field], predicted[field], average="macro", zero_division=0),
        }
        for field in FIELDS
    }
    macro_f1 = float(np.mean([metrics["macro_f1"] for metrics in field_metrics.values()]))
    output = {
        "blind_set": "v3-final-holdout",
        "blind_examples": len(cases),
        "exact_match_accuracy": exact,
        "macro_f1": macro_f1,
        "field_metrics": field_metrics,
        "thresholds": {"exact_match_accuracy": 0.70, "macro_f1": 0.65, "relationship_accuracy": 0.70},
        "deployment_gate_passed": exact >= 0.70 and macro_f1 >= 0.65 and field_metrics["relationship"]["accuracy"] >= 0.70,
        "failures": failures,
    }
    Path("blind_metrics_v3.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
