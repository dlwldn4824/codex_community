import json
import random
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import accuracy_score, f1_score
from torch import nn
from torch.optim import AdamW
from torch.utils.data import DataLoader, Dataset
from transformers import AutoTokenizer

from model import LABELS, MultiTaskModel

ROOT = Path(__file__).parent
OUTPUT = ROOT / "artifacts" / "security-fact-model-v5"
MAX_EPOCHS = 8
PATIENCE = 2
MIN_DELTA = 0.005
LABEL_TO_ID = {field: {label: index for index, label in enumerate(labels)} for field, labels in LABELS.items()}


class FactDataset(Dataset):
    def __init__(self, path):
        self.rows = [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines()]
    def __len__(self): return len(self.rows)
    def __getitem__(self, index): return self.rows[index]


def collator(tokenizer):
    def collate(rows):
        encoded = tokenizer([row["text"] for row in rows], padding=True, truncation=True, max_length=160, return_tensors="pt")
        labels = {field: torch.tensor([LABEL_TO_ID[field][row["facts"][field]] for row in rows]) for field in LABELS}
        return encoded, labels
    return collate


def evaluate(model, loader, device):
    model.eval()
    expected = {field: [] for field in LABELS}
    predicted = {field: [] for field in LABELS}
    with torch.no_grad():
        for inputs, labels in loader:
            inputs = {key: value.to(device) for key, value in inputs.items()}
            logits = model(**inputs)
            for field in LABELS:
                expected[field].extend(labels[field].tolist())
                predicted[field].extend(logits[field].argmax(-1).cpu().tolist())
    exact = np.mean([all(predicted[field][i] == expected[field][i] for field in LABELS) for i in range(len(expected["actorRole"]))])
    field_metrics = {
        field: {
            "accuracy": accuracy_score(expected[field], predicted[field]),
            "macro_f1": f1_score(expected[field], predicted[field], average="macro", zero_division=0),
        }
        for field in LABELS
    }
    return {
        "exact_match_accuracy": float(exact),
        "macro_f1": float(np.mean([item["macro_f1"] for item in field_metrics.values()])),
        "field_metrics": field_metrics,
    }


def main():
    random.seed(42); np.random.seed(42); torch.manual_seed(42)
    from generate_dataset import main as generate
    generate()
    tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
    train_loader = DataLoader(FactDataset(ROOT / "train.jsonl"), batch_size=32, shuffle=True, collate_fn=collator(tokenizer))
    validation_loader = DataLoader(FactDataset(ROOT / "validation.jsonl"), batch_size=64, collate_fn=collator(tokenizer))
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = MultiTaskModel().to(device)
    optimizer = AdamW(model.parameters(), lr=3e-5, weight_decay=0.01)
    criterion = nn.CrossEntropyLoss()
    best_exact = -1.0
    best_macro_f1 = -1.0
    epochs_without_improvement = 0

    for epoch in range(1, MAX_EPOCHS + 1):
        model.train(); total_loss = 0.0
        for inputs, labels in train_loader:
            inputs = {key: value.to(device) for key, value in inputs.items()}
            labels = {key: value.to(device) for key, value in labels.items()}
            optimizer.zero_grad()
            logits = model(**inputs)
            loss = sum(criterion(logits[field], labels[field]) for field in LABELS)
            loss.backward(); optimizer.step(); total_loss += float(loss.item())

        metrics = evaluate(model, validation_loader, device)
        print(json.dumps({"epoch": epoch, "train_loss": total_loss / len(train_loader), **metrics}))
        exact_improved = metrics["exact_match_accuracy"] > best_exact + MIN_DELTA
        tie_break_improved = abs(metrics["exact_match_accuracy"] - best_exact) <= MIN_DELTA and metrics["macro_f1"] > best_macro_f1 + MIN_DELTA
        if exact_improved or tie_break_improved:
            best_exact = metrics["exact_match_accuracy"]
            best_macro_f1 = metrics["macro_f1"]
            epochs_without_improvement = 0
            model.save(OUTPUT)
            tokenizer.save_pretrained(OUTPUT / "encoder")
            (OUTPUT / "metrics.json").write_text(json.dumps({"epoch": epoch, **metrics}, indent=2), encoding="utf-8")
        else:
            epochs_without_improvement += 1
            print(json.dumps({"early_stopping_wait": epochs_without_improvement, "patience": PATIENCE}))
            if epochs_without_improvement >= PATIENCE:
                print(json.dumps({"early_stopped_at_epoch": epoch, "best_exact_match_accuracy": best_exact}))
                break

    print((OUTPUT / "metrics.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
