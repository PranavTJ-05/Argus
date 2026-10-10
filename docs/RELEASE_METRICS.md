# Release Metrics

This file records release-gate eval runs. Release decisions should use these metrics together
with the security review, integration documentation, known limitations, and deployment smoke
results.

## v1 Candidate: 2026-05-24

Command:

```sh
pnpm eval:full
```

Dataset:

- Source: `packages/evals/src/datasets/full.ts`
- Cases: 4
- Coverage:
  - Checkout latency caused by `payment_authorize` spans.
  - Search error rate caused by index timeout errors.
  - Regional auth login latency.
  - Deployment plus feature flag regression.

Metrics:

| Metric | Value |
| --- | ---: |
| Accuracy | 1.000 |
| Evidence quality | 0.875 |
| Counsel catch rate | 1.000 |
| Calibration error | 0.000 |
| Total cost USD | 0.0890 |
| Average latency ms | 1818 |
| Baseline accuracy | 0.375 |
| Accuracy delta | 0.625 |
| Evidence quality delta | 0.521 |
| Calibration error improvement | 0.202 |

Release thresholds:

| Gate | Threshold | Result | Status |
| --- | ---: | ---: | --- |
| Accuracy | >= 0.800 | 1.000 | Pass |
| Evidence quality | >= 0.800 | 0.875 | Pass |
| Counsel catch rate | >= 0.800 | 1.000 | Pass |
| Calibration error | <= 0.150 | 0.000 | Pass |
| Total cost USD | <= 0.2500 | 0.0890 | Pass |
| Average latency ms | <= 3000 | 1818 | Pass |

Notes:

- The dataset is deterministic and validates the release-gate scorer and citation contracts.
- These metrics do not prove coverage for every production incident shape.
- The deployed v1 smoke test remains the live end-to-end check for Render, Inngest, Anthropic,
  and Postgres.

## Public Launch Candidate: 2026-05-25

Command:

```sh
pnpm eval:full
```

Dataset:

- Source: `packages/evals/src/datasets/full.ts`
- Cases: 4

Metrics:

| Metric | Value |
| --- | ---: |
| Accuracy | 1.000 |
| Evidence quality | 0.875 |
| Counsel catch rate | 1.000 |
| Calibration error | 0.000 |
| Total cost USD | 0.0890 |
| Average latency ms | 1818 |
| Baseline accuracy | 0.375 |
| Accuracy delta | 0.625 |
| Evidence quality delta | 0.521 |
| Calibration error improvement | 0.202 |

Release threshold status:

- Accuracy gate passed.
- Evidence quality gate passed.
- Counsel catch-rate gate passed.
- Calibration gate passed.
- Cost gate passed.
- Latency gate passed.

Notes:

- This run validates the deterministic release scorer and evidence-quality contracts for the public
  launch candidate.
- Hosted launch smoke passed on 2026-05-25 against the Render API/dashboard and Inngest worker.
  Smoke investigation: `bab37f46-368f-42bc-8a06-468aa9621aa3`; reported confidence: `0.37`.
- Hosted launch smoke passed again on 2026-05-27 using the signup-based launch smoke flow.
  Smoke investigation: `879de809-1d6e-49dd-b67c-590dd6e71742`; workspace:
  `launch-smoke-fb4306db`; reported confidence: `0.38`.
