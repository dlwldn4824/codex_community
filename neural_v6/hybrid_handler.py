import os
from pathlib import Path

import runpod

from base_model import FactClassifier
from relationship_model import RelationshipNLI

V5_MODEL_DIR = Path(os.getenv("V5_MODEL_DIR", "/workspace/neural_v5/artifacts/security-fact-model-v5"))
NLI_MODEL_DIR = Path(os.getenv("NLI_MODEL_DIR", Path(__file__).parent / "artifacts" / "relationship-nli-v6"))

base_classifier = FactClassifier(V5_MODEL_DIR)
relationship_nli = RelationshipNLI(NLI_MODEL_DIR)


def observed_result(status_code):
    if isinstance(status_code, int) and 200 <= status_code < 300:
        return "ALLOW"
    if status_code in (401, 403):
        return "DENY"
    return "UNKNOWN"


def normalize_identifier(value):
    if value is None:
        return None
    value = str(value).strip()
    return value if value else None


def predict(payload):
    text = payload.get("text")
    if not isinstance(text, str) or not text.strip():
        return {"error": "input.text must be a non-empty string"}

    actor_id = normalize_identifier(payload.get("actor_id"))
    owner_id = normalize_identifier(payload.get("owner_id"))
    base_result = base_classifier.predict(text)

    if actor_id is not None and owner_id is not None:
        relationship = "OWN_PROFILE" if actor_id == owner_id else "OTHER_USER"
        relationship_source = "symbolic-id-comparison"
        relationship_confidence = 1.0
        relationship_scores = None
    else:
        relationship, relationship_confidence, relationship_scores = relationship_nli.predict(text)
        relationship_source = "relationship-nli-v6"

    result = {
        "actorRole": base_result["actorRole"],
        "action": base_result["action"],
        "resource": "USER_PROFILE",
        "relationship": relationship,
        "relationshipSource": relationship_source,
        "relationshipConfidence": relationship_confidence,
        "observedResult": observed_result(payload.get("status_code")),
        "observedSource": "http-status",
    }
    if relationship_scores is not None:
        result["relationshipScores"] = relationship_scores
    return result


def handler(job):
    return predict(job.get("input", {}))


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
