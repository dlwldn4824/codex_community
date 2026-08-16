from pathlib import Path

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

BASE_MODEL = "cross-encoder/nli-distilroberta-base"
HYPOTHESES = {
    "OWN_PROFILE": "The profile belongs to the actor.",
    "OTHER_USER": "The profile belongs to another user.",
}


class RelationshipNLI:
    def __init__(self, model_dir):
        model_dir = Path(model_dir)
        self.tokenizer = AutoTokenizer.from_pretrained(model_dir)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_dir)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device).eval()

    def predict(self, evidence):
        scores = {}
        with torch.no_grad():
            for relationship, hypothesis in HYPOTHESES.items():
                inputs = self.tokenizer(evidence, hypothesis, return_tensors="pt", truncation=True, max_length=192)
                inputs = {key: value.to(self.device) for key, value in inputs.items()}
                probability = self.model(**inputs).logits.softmax(-1)[0, 1]
                scores[relationship] = float(probability)
        relationship = max(scores, key=scores.get)
        total = sum(scores.values()) or 1.0
        return relationship, round(scores[relationship] / total, 4), {key: round(value, 4) for key, value in scores.items()}
