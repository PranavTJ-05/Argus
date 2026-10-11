# First Customer Go/No-Go

Decision date: 2026-05-27

## Decision

Go for first-customer outreach as a controlled design-partner beta.

Do not pitch Argus as a mature public SaaS incident platform yet. Pitch it as a hosted beta for
one team, one workspace, and one or two evidence sources, with explicit limitations shown in the
dashboard Setup flow.

## Why This Is A Go

- The hosted API, dashboard, worker, Inngest flow, Anthropic agent loop, and Postgres persistence
  completed the launch smoke path.
- The smoke test used the real customer path: signup, workspace creation, workspace API key,
  investigation creation, workflow completion, and final report read.
- The dashboard now supports the first customer journey from landing to setup to report review.
- Reports show confidence, cited evidence, dissent, setup gaps, recommended action, and export/copy
  paths.
- Known v1 limits are visible in-product before the customer creates keys or relies on a report.
- Rollback, support, deployment, integration, and launch records are documented.

Latest hosted smoke:

```text
Dashboard URL: https://argus-dashboard.onrender.com
API URL: https://argus-api.onrender.com
Investigation: 879de809-1d6e-49dd-b67c-590dd6e71742
Workspace: launch-smoke-fb4306db
Confidence: 0.38
```

## Conditions For The First Customer

- Start with one company and one engineering team.
- Start with one service and one recurring incident type.
- Connect GitHub first unless the customer has a stronger Prometheus/Loki/Tempo path ready.
- Make clear that missing integrations reduce confidence and appear as setup gaps.
- Ask the customer to send one real incident payload through the API or a simple webhook adapter.
- Keep operator access to Render, Inngest, Postgres, and worker logs during the pilot.

## Do Not Claim Yet

- Do not claim automated root-cause certainty.
- Do not claim fully mature multi-tenant SaaS administration.
- Do not claim SSO, team invites, billing, or production-grade tenant admin.
- Do not claim branching replay or manual dissent resolution.
- Do not claim complete observability coverage unless the customer has connected the relevant tools.
- Do not claim cold-start-free production reliability while hosted on free Render services.

## Go-To-Market Pitch

Use this positioning:

```text
Argus turns production incidents into citation-backed investigation reports. It gathers
evidence, challenges the first hypothesis, records dissent, and shows confidence based on evidence
quality. The first beta goal is not to solve every incident. The goal is to prove Argus can
produce useful, auditable reports for one real recurring incident pattern.
```

## First Outreach Ask

Ask for:

1. one service they care about;
2. one recent or recurring incident pattern;
3. one evidence source they can connect first;
4. one engineer who can send an incident payload or webhook;
5. permission to run the first few investigations as beta reports, not authoritative postmortems.

## Stop Criteria

Pause outreach or downgrade the pitch if any of these happen:

- Hosted smoke fails twice after the services are warm.
- Inngest cannot reach the worker endpoint.
- Reports complete without citations for core claims.
- Workspace scoping or API key scoping fails.
- Dashboard cannot load report/evidence for completed investigations.
- A customer-reported secret, token, or private payload appears in logs or public UI.

