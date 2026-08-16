import json
from itertools import product
from pathlib import Path
import numpy as np
from sklearn.metrics import accuracy_score, f1_score
from base_model import FactClassifier
from relationship_model import RelationshipNLI

FIELDS = ("actorRole", "action", "relationship")
ROLES, ACTIONS, RELS = ("MEMBER", "ADMIN", "GUEST"), ("READ", "WRITE"), ("OWN_PROFILE", "OTHER_USER")
READ = ("reviewed", "looked at", "obtained", "pulled up", "examined")
WRITE = ("updated", "edited", "modified", "changed", "rewrote")
OWN = ("the account belonging to the active user", "that principal's personal profile", "the caller-owned record", "the same person's account", "the profile registered to the requester")
OTHER = ("an account belonging to a separate user", "a third person's profile", "a record owned outside the caller", "a different person's account", "the profile registered to somebody else")
TEMPLATES = ("The {role} {verb} {obj}.", "Audit: a {role} principal {verb} {obj}.", "With {role} access, the caller {verb} {obj}.", "Evidence shows a {role} identity {verb} {obj}.", "A session authorized as {role} {verb} {obj}.")

def cases():
    output = []
    for ci, (role, action, rel) in enumerate(product(ROLES, ACTIONS, RELS)):
        for i in range(5):
            output.append((TEMPLATES[(ci+i)%5].format(role=role, verb=(READ if action=="READ" else WRITE)[i], obj=(OWN if rel=="OWN_PROFILE" else OTHER)[i]), (role, action, rel)))
    return output

def main():
    base = FactClassifier("../neural_v5/artifacts/security-fact-model-v5")
    relation = RelationshipNLI("artifacts/relationship-nli-v6")
    expected, predicted = {f: [] for f in FIELDS}, {f: [] for f in FIELDS}; failures=[]
    for i, (text, wanted) in enumerate(cases(), 1):
        base_result = base.predict(text); rel, confidence, scores = relation.predict(text)
        actual = (base_result["actorRole"], base_result["action"], rel)
        for f, e, p in zip(FIELDS, wanted, actual, strict=True): expected[f].append(e); predicted[f].append(p)
        if actual != wanted: failures.append({"case":i,"text":text,"expected":dict(zip(FIELDS,wanted)),"predicted":dict(zip(FIELDS,actual)),"relationship_confidence":confidence,"relationship_scores":scores})
    field_metrics={f:{"accuracy":accuracy_score(expected[f],predicted[f]),"macro_f1":f1_score(expected[f],predicted[f],average="macro",zero_division=0)} for f in FIELDS}
    exact=float(np.mean([all(expected[f][i]==predicted[f][i] for f in FIELDS) for i in range(60)])); macro=float(np.mean([m["macro_f1"] for m in field_metrics.values()]))
    result={"blind_set":"v4-final-holdout","blind_examples":60,"exact_match_accuracy":exact,"macro_f1":macro,"field_metrics":field_metrics,"deployment_gate_passed":exact>=.70 and macro>=.65 and field_metrics["relationship"]["accuracy"]>=.80,"failures":failures}
    Path("blind_metrics_v4.json").write_text(json.dumps(result,indent=2),encoding="utf-8"); print(json.dumps(result,indent=2))
if __name__ == "__main__": main()
