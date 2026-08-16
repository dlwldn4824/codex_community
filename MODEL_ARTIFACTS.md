# Model artifacts

The trained model weights are intentionally excluded from Git because the release archive is about 526 MB and contains files larger than GitHub's normal file limit.

Local release archive:

```text
vibecheck-hybrid-release-v6.tar.gz
```

SHA-256:

```text
DB70AA1A33587E828D7E62311709E74538AACBC78B058013D3C682BCB8044ACB
```

Evaluation summaries and reproducible training/inference source are committed under `neural_v5/` and `neural_v6/`. The model archive must be distributed through external object storage or a RunPod deployment, not committed directly to this repository.
