import json
from pathlib import Path

import torch
from torch import nn
from transformers import AutoModel, AutoTokenizer

LABELS = {
    "actorRole": ("ADMIN", "GUEST", "MEMBER"),
    "action": ("READ", "WRITE"),
    "relationship": ("OTHER_USER", "OWN_PROFILE"),
}


class MultiTaskModel(nn.Module):
    def __init__(self, encoder_name_or_path="distilbert-base-uncased"):
        super().__init__()
        self.encoder = AutoModel.from_pretrained(encoder_name_or_path)
        hidden = self.encoder.config.hidden_size
        self.dropout = nn.Dropout(0.2)
        self.heads = nn.ModuleDict({field: nn.Linear(hidden, len(labels)) for field, labels in LABELS.items()})

    def forward(self, **inputs):
        pooled = self.encoder(**inputs).last_hidden_state[:, 0]
        pooled = self.dropout(pooled)
        return {field: head(pooled) for field, head in self.heads.items()}

    def save(self, directory):
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        self.encoder.save_pretrained(directory / "encoder")
        torch.save(self.heads.state_dict(), directory / "heads.pt")
        (directory / "labels.json").write_text(json.dumps(LABELS, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, directory):
        directory = Path(directory)
        model = cls(directory / "encoder")
        model.heads.load_state_dict(torch.load(directory / "heads.pt", map_location="cpu", weights_only=True))
        return model


class FactClassifier:
    def __init__(self, model_dir):
        model_dir = Path(model_dir)
        self.tokenizer = AutoTokenizer.from_pretrained(model_dir / "encoder")
        self.model = MultiTaskModel.load(model_dir)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device).eval()

    def predict(self, text):
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=160)
        inputs = {key: value.to(self.device) for key, value in inputs.items()}
        with torch.no_grad():
            logits = self.model(**inputs)
        result, confidence = {}, {}
        for field, values in logits.items():
            probabilities = values.softmax(-1)[0]
            index = int(probabilities.argmax())
            result[field] = LABELS[field][index]
            confidence[field] = round(float(probabilities[index]), 4)
        return {**result, "resource": "USER_PROFILE", "confidence": confidence, "extractor": "runpod-distilbert-multitask-v5"}
