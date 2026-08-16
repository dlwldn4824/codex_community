import json
import random
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import accuracy_score, f1_score
from torch.optim import AdamW
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from relationship_model import BASE_MODEL

ROOT = Path(__file__).parent
OUTPUT = ROOT / "artifacts" / "relationship-nli-v6"
MAX_EPOCHS, PATIENCE, MIN_DELTA = 8, 2, 0.005


class PairDataset(Dataset):
    def __init__(self, path): self.rows = [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines()]
    def __len__(self): return len(self.rows)
    def __getitem__(self, index): return self.rows[index]


def collator(tokenizer):
    def collate(rows):
        inputs = tokenizer([r["evidence"] for r in rows], [r["hypothesis"] for r in rows], padding=True, truncation=True, max_length=192, return_tensors="pt")
        return inputs, torch.tensor([r["label"] for r in rows])
    return collate


def evaluate(model, loader, device):
    expected, predicted = [], []
    model.eval()
    with torch.no_grad():
        for inputs, labels in loader:
            inputs = {key: value.to(device) for key, value in inputs.items()}
            values = model(**inputs).logits.argmax(-1).cpu().tolist()
            expected.extend(labels.tolist()); predicted.extend(values)
    return {"accuracy": accuracy_score(expected, predicted), "macro_f1": f1_score(expected, predicted, average="macro", zero_division=0)}


def main():
    from generate_relationship_dataset import main as generate
    generate()
    random.seed(63); np.random.seed(63); torch.manual_seed(63)
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(BASE_MODEL)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    train_loader = DataLoader(PairDataset(ROOT / "relationship_train.jsonl"), batch_size=24, shuffle=True, collate_fn=collator(tokenizer))
    val_loader = DataLoader(PairDataset(ROOT / "relationship_validation.jsonl"), batch_size=48, collate_fn=collator(tokenizer))
    optimizer = AdamW(model.parameters(), lr=1e-5, weight_decay=0.01)
    best, waits = -1.0, 0
    for epoch in range(1, MAX_EPOCHS + 1):
        model.train(); total = 0.0
        for inputs, labels in train_loader:
            inputs = {key: value.to(device) for key, value in inputs.items()}; labels = labels.to(device)
            optimizer.zero_grad(); loss = model(**inputs, labels=labels).loss
            loss.backward(); optimizer.step(); total += float(loss.item())
        metrics = evaluate(model, val_loader, device)
        print(json.dumps({"epoch": epoch, "train_loss": total / len(train_loader), **metrics}))
        if metrics["macro_f1"] > best + MIN_DELTA:
            best, waits = metrics["macro_f1"], 0
            OUTPUT.mkdir(parents=True, exist_ok=True)
            model.save_pretrained(OUTPUT); tokenizer.save_pretrained(OUTPUT)
            (OUTPUT / "metrics.json").write_text(json.dumps({"epoch": epoch, **metrics}, indent=2), encoding="utf-8")
        else:
            waits += 1
            print(json.dumps({"early_stopping_wait": waits, "patience": PATIENCE}))
            if waits >= PATIENCE:
                print(json.dumps({"early_stopped_at_epoch": epoch, "best_macro_f1": best}))
                break
    print((OUTPUT / "metrics.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
