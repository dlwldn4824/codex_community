# Neural fact classifier V5

- Shared DistilBERT encoder with actorRole, action, and relationship heads.
- 800 balanced training examples and 200 held-out-template validation examples.
- Natural-language and structured HTTP/audit evidence are mixed 50/50.
- Early stopping uses a maximum of 8 epochs, patience 2, and minimum delta 0.005.
- Natural and structured formats are balanced inside every label combination.
- `evaluate_blind_v2.py` is retained only as the V4 development evaluation.
- `evaluate_blind_v3.py` is the new final 60-example holdout and must not be used for training or iterative tuning.
- `observedResult` is derived deterministically from the HTTP status code in `handler.py`.

Run:

```bash
pip install -r requirements.txt
python train.py
python evaluate_blind_v3.py
```
