# VibeCheck Neural V4 Build Log

## 2026-08-16 — V3 blind evaluation follow-up

### Evidence

- V3 final holdout: 15 examples
- Exact match accuracy: 0.5333
- Field-average macro F1: 0.8107
- actorRole accuracy: 1.0000
- action accuracy: 0.7333
- relationship accuracy: 0.7333
- Deployment gate: FAIL because exact match was below 0.70

### Decision

- Keep the shared DistilBERT encoder and three field-specific classification heads.
- Keep the total synthetic dataset at 1,000 examples.
- Improve semantic generalization instead of copying failed blind sentences into training.
- Add early stopping to reduce unnecessary memorization.
- Replace the 15-example development evaluation with a new 60-example final holdout.

### V4 implementation

- 800 training and 200 validation examples.
- All 12 combinations of role, action, and relationship are balanced at 66–67 examples per combination in training.
- Natural-language and structured audit/API evidence are mixed 50/50.
- READ, WRITE, OWN_PROFILE, and OTHER_USER use varied paraphrases.
- Validation uses templates not present in training.
- Training is capped at 8 epochs with patience 2 and minimum improvement 0.005.
- The best checkpoint is stored in `artifacts/security-fact-model-v4`.
- A new final holdout contains 60 examples: 12 label combinations × 5 unseen variations.
- Deployment gate remains exact match >= 0.70, macro F1 >= 0.65, and relationship accuracy >= 0.70.
- `observedResult` remains deterministic from the HTTP status code and is not predicted by the neural model.

### Verification

- Python syntax compilation completed.
- Dataset generation completed: train 800, validation 200.
- Training label balance verified: every combination has 66 or 67 examples.
- No commit, push, PR, or team-branch update was performed.

## 2026-08-16 — V5 data-correlation fix

- V4 final holdout exact match was 0.4667 and relationship accuracy was 0.5000.
- Root cause: index parity made natural text correlate with OWN_PROFILE and structured text correlate with OTHER_USER.
- Fixed generation so natural and structured formats alternate inside each of the 12 label combinations.
- Kept the dataset at 800 training and 200 validation examples.
- Retained V2 blind results as development evidence and created a new 60-example V3 final holdout.
- Updated checkpoint and handler paths to `security-fact-model-v5`.
