# VibeSpec

> Attack it before users do.

VibeSpec is a neuro-symbolic Codex security harness for vibe-coded software. It executes an adversarial authorization scenario, maps the observed behavior to deterministic security rules, and presents evidence for human approval.

## Golden demo

1. Approve the extracted symbolic security policy.
2. Run the Codex build.
3. Observe the feature test pass.
4. Observe `MEMBER → GET /api/admin/users → 200 OK`.
5. Review the violated `SEC-AUTH-03` rule and approve the repair.
6. Re-run the same attack, observe `403`, and approve release.

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm test
npm run lint
npm run build
```

The current demo executes requests against an in-browser authorization policy. It does not claim general-purpose network penetration-testing coverage.
