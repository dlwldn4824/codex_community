import os
from pathlib import Path

import runpod
from model import FactClassifier

MODEL_DIR = Path(os.getenv("MODEL_DIR", Path(__file__).parent / "artifacts" / "security-fact-model-v5"))
classifier = FactClassifier(MODEL_DIR)


def handler(job):
    payload = job.get("input", {})
    text, status = payload.get("text"), payload.get("status_code")
    if not isinstance(text, str) or not text.strip():
        return {"error": "input.text must be a non-empty string"}
    observed = "ALLOW" if isinstance(status, int) and 200 <= status < 300 else "DENY" if status in (401, 403) else "UNKNOWN"
    return {**classifier.predict(text), "observedResult": observed, "observedSource": "http-status"}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
