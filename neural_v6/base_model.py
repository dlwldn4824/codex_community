import json
from pathlib import Path
import torch
from torch import nn
from transformers import AutoModel, AutoTokenizer

LABELS = {"actorRole": ("ADMIN", "GUEST", "MEMBER"), "action": ("READ", "WRITE"), "relationship": ("OTHER_USER", "OWN_PROFILE")}

class MultiTaskModel(nn.Module):
    def __init__(self, encoder_name_or_path):
        super().__init__(); self.encoder = AutoModel.from_pretrained(encoder_name_or_path)
        hidden = self.encoder.config.hidden_size; self.dropout = nn.Dropout(0.2)
        self.heads = nn.ModuleDict({field: nn.Linear(hidden, len(labels)) for field, labels in LABELS.items()})
    def forward(self, **inputs):
        pooled = self.dropout(self.encoder(**inputs).last_hidden_state[:, 0])
        return {field: head(pooled) for field, head in self.heads.items()}
    @classmethod
    def load(cls, directory):
        directory = Path(directory); model = cls(directory / "encoder")
        model.heads.load_state_dict(torch.load(directory / "heads.pt", map_location="cpu", weights_only=True)); return model

class FactClassifier:
    def __init__(self, model_dir):
        model_dir = Path(model_dir); self.tokenizer = AutoTokenizer.from_pretrained(model_dir / "encoder")
        self.model = MultiTaskModel.load(model_dir); self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device).eval()
    def predict(self, text):
        inputs = {k: v.to(self.device) for k, v in self.tokenizer(text, return_tensors="pt", truncation=True, max_length=160).items()}
        with torch.no_grad(): logits = self.model(**inputs)
        result = {}
        for field, values in logits.items(): result[field] = LABELS[field][int(values.softmax(-1)[0].argmax())]
        return result
