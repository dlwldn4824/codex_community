# VibeSpec

> Attack it before users do.

Vibe coding lowered the barrier to building software, but it did not lower the barrier to security verification. VibeSpec is a **Neuro-Symbolic Codex Security Harness** that executes an adversarial authorization scenario, captures the result, maps it to an explicit security rule, and gives a human evidence for the final decision.

## Product question

Existing coding tools ask: **Does the feature work?**

VibeSpec asks: **Does the attack work too?**

The product does not report that code “may be vulnerable.” It executes a concrete adversarial request and connects the observed response to a deterministic rule verdict.

## Golden demo

1. Extract symbolic authorization rules and ask a human to approve them.
2. Add an administrator user API.
3. Run build and the normal administrator feature test successfully.
4. Launch the authorization attack scenario as a member.
5. Execute `MEMBER → GET /api/admin/users` and observe `HTTP 200`.
6. Mark `SEC-AUTH-03` violated and present the counterexample, impact, and proposed fix.
7. Apply the repair only after explicit human approval.
8. Execute the same attack again, observe `403`, and request human release approval.

## Success signal

The judge sees `BUILD ✓ / FEATURE ✓ / SECURITY ✕` and the message: **“The feature works. So does the attack.”**

## Claim boundary

The current Golden Demo executes an adversarial request against an in-browser executable authorization policy. It does not yet send network traffic to an independently running HTTP service, crawl arbitrary applications, or claim general penetration-testing coverage.
