# V6 Build Log

- V5 Blind V3: exact match 0.45, action accuracy 0.7667, relationship accuracy 0.5833.
- Decision: preserve actorRole/action and replace relationship with a dedicated NLI cross-encoder.
- Added balanced entailment/contradiction pairs, phrase-family validation holdout, early stopping, and a new Blind V4 holdout.
- No commit, push, or PR was performed.
- Final Blind V4: exact match 0.90, macro F1 0.9663, relationship accuracy 1.00.
- OOD contrast test: example accuracy 0.875, pair flip accuracy 0.75.
- Contrast failures were concentrated in arbitrary identifier equality comparisons.
- Added a hybrid handler: exact actor_id/owner_id comparison is symbolic; natural-language ownership falls back to relationship NLI V6.
