# Relationship NLI V6

- Keeps the V5 actorRole/action classifier.
- Replaces relationship with a dedicated NLI cross-encoder.
- Trains on 400 evidence items paired with two opposite hypotheses (800 pairs).
- Validates on 100 held-out evidence items (200 pairs): 1,000 total pairs.
- Uses early stopping and a new locked 60-example Blind V4 evaluation.

```bash
pip install -r requirements.txt
python train_relationship.py
python evaluate_blind_v4.py
```
