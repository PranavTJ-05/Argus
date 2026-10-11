# Launch Readiness

Consolidated record of the first-customer decision, release metrics and launch checklist.

## Decision

**Go for controlled design-partner outreach.** Present Argus as a hosted beta for one team and one workspace with one or two evidence sources, not as a mature public SaaS.

Why:

- The hosted API, dashboard, worker, Inngest flow, agent loop and Postgres passed the launch smoke test through the real customer path: signup, workspace, API key, investigation, workflow, report.
- The dashboard covers landing, setup and report review, with confidence, citations, dissent, setup gaps, recommendations and copy or export.
- Known limits are visible in the product before customers rely on a report.
- Rollback, support, deployment, integration and launch procedures are documented.

Conditions:

- One company, one team, one service, one recurring incident type.
- Connect GitHub first unless Prometheus, Loki or Tempo is already ready.
- Explain that missing integrations lower confidence and appear as gaps.
- Keep operator access to Render, Inngest, Postgres and worker logs during the pilot.

Do not claim: automated root-cause certainty, mature multi-tenant administration, SSO, invites or billing, branching replay or manual dissent resolution, complete observability coverage, or cold-start-free reliability on free hosting.

Pause outreach if: smoke fails twice on warm services, Inngest cannot reach the worker, reports finish without core citations, workspace or key scoping fails, completed reports cannot load evidence, or a secret or private payload shows up in logs or public UI.

## Release metrics

Baseline from the v1 candidate run of `pnpm eval:full` (4 deterministic cases: checkout latency, search error rate, regional auth latency, deploy plus flag regression):

| Metric | Result | Gate |
| --- | ---: | --- |
| Accuracy | 1.000 | >= 0.800 |
| Evidence quality | 0.875 | >= 0.800 |
| Counsel catch rate | 1.000 | >= 0.800 |
| Calibration error | 0.000 | <= 0.150 |
| Total cost (USD) | 0.0890 | <= 0.2500 |
| Average latency (ms) | 1818 | <= 3000 |

The baseline scored 0.375 accuracy, so the agent loop improved accuracy by 0.625 and evidence quality by 0.521. The dataset validates scoring and citation contracts, not every incident shape. The hosted smoke test remains the live check across hosting, Inngest, the model provider and Postgres.

Append new runs here with date, command, dataset and results.

## Launch checklist

- [ ] Hosted URLs recorded: dashboard, API, worker, Inngest sync (`/api/inngest`)
- [ ] Migrations applied to the production database
- [ ] All required variables set ([../guides/configuration.md](../guides/configuration.md))
- [ ] `pnpm smoke:launch` passes against the deployment
- [ ] Rollback path confirmed ([../operations/runbook.md](../operations/runbook.md#5-rollback))
- [ ] Phase 34 acceptance gate completed ([../project/delivery-plan.md](../project/delivery-plan.md))
