# VibeSpec Architecture

VibeSpec is a closed-loop neuro-symbolic authorization security harness.

## Runtime flow

`Security intent → Symbolic policy → Human approve → Build → Attack → Evidence → Rule verdict → Human decide → Repair → Re-attack → Human release`

## Human decision gates

1. **Policy approval** — Is the AI-extracted security policy an accurate representation of the intended access boundary?
2. **Repair approval** — Does the counterexample justify the proposed patch, and does the patch preserve the requested feature?
3. **Release approval** — Do the build, functional, and constitutional results provide enough evidence to release?

The harness does not ask a human to continuously supervise an agent. It pauses only at consequential decisions and supplies the evidence needed to decide.

## Modules

- `IntentExtractor`: converts the Golden Demo security requirement into typed actors, resources, and authorization rules.
- `ConstitutionStore`: keeps human-approved security rules as the shared source of truth.
- `CodexRunner`: produces an explicit patch attempt. The demo adapter is deterministic because no Codex CLI or API credential is available in the local environment.
- `BuildRunner`: validates that the generated policy source is syntactically executable.
- `AttackRunner`: executes administrator and member requests against the current authorization policy.
- `VerificationEngine`: compares observed status codes with deterministic `ALLOW` and `DENY` rules. It never asks an LLM to grade an LLM.
- `EvidenceCollector`: returns the actor, request, response, exposed subject, and violated rule.
- `RecoveryContextBuilder`: combines original intent, violated rule, previous patch, evidence, and constraints.
- `Orchestrator`: advances the visible Build–Verify–Decide–Recover state machine and cannot cross a decision gate without human input.

## Trust boundary

Neural reasoning interprets code and attack evidence and proposes patches. Symbolic security rules decide `PASS`, `FAIL`, or `UNKNOWN` from observed behavior. Humans approve the policy, repair, and release.

## Demo safety

The Golden Path runs entirely in the browser with an executable authorization policy, so it is reliable without network credentials. The request and response are real function execution, but not network HTTP traffic. The demo therefore proves adversarial scenario execution and symbolic authorization verification—not general-purpose penetration testing. The Codex boundary remains isolated behind `CodexRunner`.
