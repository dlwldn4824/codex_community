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

BLIND_TEMPLATES = (
    "A person assigned {role} privileges {action_phrase} {relation_phrase}.",
    "The activity report attributes {relation_phrase} being {action_participle} to a {role} principal.",
    "With the permission level {role}, the caller {action_phrase} {relation_phrase}.",
    "Incident evidence shows that a {role} identity {action_phrase} {relation_phrase}.",
    "A {role}-authorized session resulted in {relation_phrase} being {action_participle}.",
)
READ_PHRASES = ("examined", "displayed", "consulted", "inspected", "loaded")
WRITE_PHRASES = ("amended", "overwrote", "made changes to", "reconfigured", "corrected")
READ_PARTICIPLES = ("examined", "displayed", "consulted", "inspected", "loaded")
WRITE_PARTICIPLES = ("amended", "overwritten", "changed", "reconfigured", "corrected")
OWN_PHRASES = (
    "the identity's personal profile",
    "the account associated with that same caller",
    "a user record owned by the principal",
    "the caller's individual account",
    "the profile attached to that identity",
)
OTHER_PHRASES = (
    "a profile assigned to a separate identity",
    "an account held by a different person",
    "a user record not owned by the caller",
    "a separate customer's account",
    "the profile attached to another identity",
)


def build_cases():
    cases = []
    combinations = list(product(ROLES, ACTIONS, RELATIONSHIPS))
    for combination_index, (role, action, relationship) in enumerate(combinations):
        for variation in range(5):
            action_phrase = (READ_PHRASES if action == "READ" else WRITE_PHRASES)[variation]
            action_participle = (READ_PARTICIPLES if action == "READ" else WRITE_PARTICIPLES)[variation]
            relation_phrase = (OWN_PHRASES if relationship == "OWN_PROFILE" else OTHER_PHRASES)[variation]
            text = BLIND_TEMPLATES[(combination_index + variation) % len(BLIND_TEMPLATES)].format(
                role=role,
                action_phrase=action_phrase,
                action_participle=action_participle,
                relation_phrase=relation_phrase,
            )
            cases.append((text, (role, action, relationship)))
    return cases


def main():
    cases = build_cases()
    model = FactClassifier("artifacts/security-fact-model-v4")
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
        "blind_set": "v2-final-holdout",
        "blind_examples": len(cases),
        "exact_match_accuracy": exact,
        "macro_f1": macro_f1,
        "field_metrics": field_metrics,
        "thresholds": {"exact_match_accuracy": 0.70, "macro_f1": 0.65, "relationship_accuracy": 0.70},
        "deployment_gate_passed": exact >= 0.70 and macro_f1 >= 0.65 and field_metrics["relationship"]["accuracy"] >= 0.70,
        "failures": failures,
    }
    Path("blind_metrics_v2.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
