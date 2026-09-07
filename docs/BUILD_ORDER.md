# Build Order

Build Argus in vertical slices. Each phase should leave the repository in a working state.

Do not start with dashboard polish, replay branching, or every backend integration. First prove the investigation loop.

## Phase 0: Monorepo and Schemas

Definition of done:

- TypeScript strict mode is configured.
- `noUncheckedIndexedAccess` is enabled.
- Monorepo structure exists.
- Shared Zod schemas exist.
- Drizzle schema exists.
- Config loader exists.
- Model alias config exists.
- Basic Vitest setup exists.

Expected packages:

```text
apps/api
apps/worker
apps/dashboard
packages/shared-types
packages/config
packages/db
packages/llm-gateway
packages/agents
packages/backends
packages/otel
```

## Phase 1: API and Persistence

Definition of done:

- Postgres migrations run locally.
- API server exposes `POST /investigations`.
- API server exposes `GET /investigations/:id`.
- API server exposes artifact read route skeletons.
- API server exposes SSE route from `investigation_events`.
- Investigation creation persists a row.
- Request/response schemas are validated with Zod.

## Phase 2: Durable Workflow Skeleton

Definition of done:

- Inngest workflow handles `investigation.requested`.
- Workflow creates or loads investigation state.
- Workflow emits events.
- Workflow advances phases.
- Workflow enforces max rounds.
- Workflow checks cancellation.
- Workflow writes idempotently by deterministic `step_key`.

No real LLMs are required yet.

## Phase 3: Mocked Agent Loop

Definition of done:

- Director runs against mocked context.
- One mocked Expert returns citation-backed findings.
- Tool call rows are created before findings.
- Critic scores mocked findings.
- Reporter writes a structured final report.
- Final report has an evidence chain.
- Confidence is computed by deterministic code.

This is the first true product slice.

## Phase 4: Real Observability Backends

Definition of done:

- Trace Expert can query Tempo.
- Log Expert can query Loki.
- Metric Expert can query Prometheus.
- Deploy Expert can use mock JSON first, then GitHub Actions.
- Code Expert can inspect a local git clone with ripgrep.
- Tools enforce timeouts and result-size limits.
- Raw tool results are persisted.

## Phase 5: Full Phase Machine

Definition of done:

- TRIAGE -> TRACE -> VERDICT transitions work.
- Director can run multiple rounds.
- Critic produces Review and Timeline.
- Evidence gaps are persisted.
- Failed and cancelled states work.
- Round limit works.

## Phase 6: Counsel and Confidence

Definition of done:

- Counsel writes Dissent Log entries.
- Counsel cites evidence or missing-evidence gaps.
- Director can respond to dissent.
- Strong unresolved dissent can force another TRACE round.
- Final confidence uses:
  - evidence support,
  - Critic credibility,
  - unresolved dissent strength.

## Phase 7: Dashboard

Definition of done:

- Inbox lists investigations.
- Live View streams events over SSE.
- Report View shows verdict, confidence, timeline, evidence chain, dissent, and recommended fix.
- Evidence links open tool call input/result.
- Read-only Replay View can scrub through `investigation_events`.

Do not implement branching replay in v1.

## Phase 8: Evaluation and Deployment

Definition of done:

- Eval harness runs with Vitest.
- Smoke subset exists.
- Full dataset runner exists.
- Metrics include accuracy, evidence quality, Counsel-catches-Director rate, calibration, cost, and latency.
- Baseline comparison exists.
- Demo is deployed or reproducible locally.

## Phase 9: Real LLM Gateway and Agents

Definition of done:

- Mocked agent outputs are no longer the default workflow path.
- `packages/llm-gateway` calls the configured LLM provider through model aliases.
- Director, Expert, Critic, Counsel, and Reporter use strict JSON outputs validated by Zod.
- Validation failure triggers one repair retry with the validation error included.
- Every agent output stores `prompt_version`, `model_alias`, concrete `model_id`, input snapshot, output JSON, token/cost metadata when available, and validation errors.
- The workflow can run the first live vertical slice:

```text
POST /investigations
-> Inngest workflow
-> real Director
-> one real Expert using persisted tool results
-> real Critic
-> real Counsel
-> real Reporter
-> persisted report with citations
```

Required credentials in `.env`:

- `ANTHROPIC_API_KEY`

Optional model alias overrides:

- `MODEL_DIRECTOR_PRIMARY`
- `MODEL_EXPERT_CHEAP`
- `MODEL_CRITIC_BALANCED`
- `MODEL_COUNSEL_BALANCED`
- `MODEL_REPORTER_PRIMARY`

## Phase 10: Live Tool Integrations

Definition of done:

- Trace, log, metric, deploy, flag, and code experts call live tool adapters where configured.
- Tempo, Loki, Prometheus, GitHub Actions, local git, and feature flag adapters return normalized tool results.
- Tool calls are persisted before any agent summary.
- Tool failures become cited evidence gaps, not silent hallucinations.
- Integrations have timeouts, result-size limits, retries where safe, and tests with mocked HTTP responses.
- The dashboard evidence view can inspect live tool call arguments, results, duration, and errors.

Required credentials in `.env` depend on enabled integrations:

- `TEMPO_ENDPOINT`
- `LOKI_ENDPOINT`
- `PROMETHEUS_ENDPOINT`
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `LAUNCHDARKLY_API_TOKEN` if feature flags are enabled.

## Phase 11: External Integration API

Definition of done:

- External users can create investigations through documented HTTP APIs.
- API authentication is enforced for write endpoints.
- Rate limiting and request size limits protect public surfaces.
- API request and response contracts are documented with examples.
- Integrators can pass incident metadata, service names, time windows, deploy refs, commit SHAs, and feature flag context.
- SSE replay and report read endpoints are stable enough for external clients.
- Errors are structured, documented, and safe to expose.

Required credentials in `.env`:

- `API_KEY` for local single-key mode.
- Production deployment should use managed secrets instead of committing keys.

## Phase 12: Production Workflow Hardening

Definition of done:

- Inngest is configured for the target deployment mode.
- Workflow idempotency is verified across retries and duplicate events.
- Database migrations are safe to run in deploy pipelines.
- API, worker, and dashboard expose health checks.
- OpenTelemetry traces, metrics, and logs are emitted with useful service names.
- SSE reconnect behavior is tested.
- Failed, cancelled, and partial-investigation states are visible in the dashboard and API.

Required credentials in `.env`:

- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_BASE_URL`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

## Phase 13: Deployment

Definition of done:

- API, worker, and dashboard have production build/start commands.
- Containers or platform-specific deploy config exist.
- Production env var checklist exists.
- Database migration command is part of deploy instructions.
- Smoke test validates create investigation -> workflow -> report -> dashboard read.
- Public or private v1 deployment is reachable by an external user.

Required deployment inputs:

- Hosted Postgres URL.
- Runtime hosting target for API, worker, and dashboard.
- Secret manager or deployment environment variables.
- Public dashboard/API URLs.

## Phase 14: v1 Release Gate

Definition of done:

- Full eval dataset is run and results are recorded.
- Accuracy, evidence quality, Counsel catch rate, calibration, cost, and latency meet the release threshold.
- Security review covers secrets, auth, rate limiting, CORS, and external request validation.
- User-facing integration docs are complete.
- Known limitations are documented.
- v1 release tag is created after checks pass.

## Phase 15: Customer-Facing Dashboard Clarity

Definition of done:

- The dashboard explains each investigation in customer language, not internal agent language.
- The primary completed view starts with most likely cause, confidence, evidence summary, dissent summary, and recommended next action.
- Raw tool calls, agent outputs, and validation details are hidden behind advanced inspection controls.
- Failed or skipped integrations are shown as clear setup gaps, for example "Prometheus is not connected" instead of raw adapter errors.
- Test/smoke investigations are clearly labeled or filterable so they do not look like real customer incidents.
- Empty states tell the user how to create the first investigation through API or UI.

## Phase 16: Create Investigation UI

Definition of done:

- A customer can create an investigation from the dashboard without curl.
- The form collects incident ID, service, environment, severity, summary, and time window.
- Optional fields support deploy ref, commit SHA, log query, metric query, code pattern, and feature flag context.
- Submission calls `POST /investigations` through the API server with the configured API key strategy.
- Success selects the new investigation and shows live progress.
- Validation errors are shown in customer language.

## Phase 17: Customer Integration Guide In Product

Definition of done:

- The dashboard includes a setup page or panel with the API base URL, endpoint, request shape, and curl example.
- The page explains what the customer API key is for and how it differs from internal provider credentials.
- The page documents the minimum useful integration path:
  - manual API call,
  - monitoring alert webhook,
  - deploy metadata,
  - optional evidence backends.
- Copy is suitable for sending to a first design-partner customer.

## Phase 18: First Real Customer Evidence Integration

Definition of done:

- At least one real external evidence source is configured end to end for a customer demo.
- Prefer the first integration that is easiest for the target customer to provide and understand.
- The integration returns cited evidence that appears in the report and evidence inspector.
- Missing credentials or permissions produce cited evidence gaps, not silent failures.
- The integration setup steps are documented for the customer.

Recommended first choices:

1. GitHub code/deploy evidence.
2. Prometheus metric evidence.
3. Loki log evidence.
4. Tempo trace evidence.

## Phase 19: Demo Dataset and Pitch Script

Definition of done:

- A clean demo investigation exists and is separated from noisy smoke tests.
- The demo shows a realistic incident, evidence chain, dissent, confidence, and recommendation.
- A first-customer pitch script explains:
  - the pain,
  - what Argus does,
  - why citations matter,
  - what the dashboard sections mean,
  - what the customer needs to provide,
  - what v1 does not do yet.
- A short product walkthrough exists for a 5-10 minute live demo.

## Phase 20: Private Beta Readiness

Definition of done:

- The product can be used by one company or one first customer in a controlled single-tenant private beta.
- Write API keys are managed intentionally and can be rotated.
- Read access risk is documented or protected for the chosen single-tenant deployment.
- Known limitations are visible to the customer before onboarding.
- Basic usage, cost, and failure monitoring exist for the operator.
- A beta onboarding checklist exists.

## Phase 21: Single-Tenant Company Deployment Template

Definition of done:

- A repeatable deployment guide exists for one company/customer per isolated Argus instance.
- The guide explains how to create separate API, worker, dashboard, and Postgres services for each company.
- A customer-specific Render blueprint or documented naming convention exists.
- Required env vars are split into operator-owned, customer-provided, and generated values.
- The deployment flow includes migrations, Inngest sync, smoke test, dashboard URL, API URL, and API key handoff.
- The docs clearly say this is not multi-tenant SaaS.

Phase 20 and Phase 21 are now fallback/private-beta support only. The launch path from Phase 22
onward is a real authenticated product, not a one-company deployment plan.

## Phase 22: Launch Auth Foundation

Definition of done:

- Users can log in.
- Users can log out.
- Dashboard pages require an authenticated session.
- Session handling works locally and in production.
- Auth callbacks, secrets, and redirect URLs are documented.
- The current unauthenticated dashboard path is removed or locked behind development mode.
- A first admin user can create or join a workspace.
- Tests cover protected dashboard routes and API session checks.

## Phase 23: Workspace Data Isolation

Definition of done:

- Organizations or workspaces exist as first-class database records.
- Every investigation belongs to exactly one workspace.
- Investigation events, artifacts, reports, tool calls, agent outputs, and integration records are workspace-scoped.
- Dashboard reads only return the logged-in user's workspace data.
- API reads and SSE streams only return the caller's workspace data.
- Roles exist at minimum as admin, engineer, and viewer.
- Tenant isolation tests prove one workspace cannot read another workspace's data.

## Phase 24: Workspace API Keys and Customer Onboarding

Definition of done:

- Workspace admins can create, view metadata for, rotate, and revoke API keys.
- Raw API key secrets are shown only once and stored hashed.
- API keys create investigations only inside their workspace.
- API keys can be limited by status, name, and last-used metadata.
- The dashboard has a clean onboarding flow from signup to first workspace to first API key.
- The setup page uses the logged-in workspace's real API URL and API key guidance.
- Existing single shared `API_KEY` is kept only for local development or removed from production.

## Phase 25: Per-Workspace Integration Credentials

Definition of done:

- GitHub, Prometheus, Loki, Tempo, and optional flag credentials are stored per workspace.
- Secrets are encrypted or delegated to a managed secret store.
- Tool adapters resolve credentials from the investigation workspace, not global env vars.
- Missing credentials produce workspace-specific setup gaps.
- The dashboard shows integration connection status per workspace.
- Tests prove one workspace cannot use another workspace's integration credentials.

## Phase 26: Usage, Limits, and Account Controls

Definition of done:

- Model token usage, estimated cost, investigation count, and workflow latency are tracked per workspace.
- Rate limits apply per workspace/API key, not globally only.
- Workspace status can be active, suspended, or disabled.
- Suspended workspaces cannot create new investigations but can still read allowed historical data.
- Admin/operator views show failed runs, cost, usage, and workspace health.
- Billing can be manual for launch, but account disable behavior must exist.

## Phase 27: Launch Security and Reliability Gate

Definition of done:

- Security review is updated for authenticated multi-customer launch.
- CORS is workspace/deployment safe.
- Read APIs require auth or workspace API key access.
- Secrets are not exposed in client bundles, logs, traces, screenshots, or docs.
- Database migrations are rollback-aware and safe for production deploys.
- Inngest retries, duplicate events, failed runs, and partial failures are tested.
- A launch smoke test covers signup/login -> workspace -> API key -> create investigation -> report -> dashboard read.
- Playwright covers the main authenticated dashboard workflow.

## Phase 28: Public Launch Readiness

Definition of done:

- Landing page explains the product clearly.
- Signup/login works from the public site.
- New users can create a workspace and run the first investigation without operator help.
- Integration docs are updated for workspace API keys.
- Product docs explain citations, confidence, dissent, and setup gaps.
- Support, rollback, incident response, and customer handoff runbooks are complete.
- Release metrics and evals pass.
- Public launch tag is created after checks pass.

## Phase 29: Dashboard Stability and UX Maturity

Definition of done:

- The main authenticated dashboard feels stable under loading, empty, running, completed, failed, and partial states.
- The investigation list, selected investigation, tabs, and evidence inspector do not visually jump during refreshes or SSE updates.
- Loading states use fixed-size skeletons or reserved layout space instead of flashing blank panels.
- API errors, worker delays, disconnected SSE, and missing reports are shown as useful customer-facing states.
- The dashboard works on laptop and tablet widths without text overlap, clipped controls, or unusable side panels.
- Search, filter, refresh, tab selection, and selected-investigation state are predictable and preserved where appropriate.
- Playwright covers the main dashboard states and catches layout regressions that would confuse a customer.
- Performance budgets are recorded for first load, investigation switch, report render, and evidence inspector open.

## Phase 30: First-Run Activation and Guided Setup

Definition of done:

- A new user who signs up understands the next action within 30 seconds.
- The dashboard starts with a guided checklist: create API key, connect GitHub, create first investigation, review first report.
- The first-run experience can create a safe demo investigation without needing production credentials.
- Setup progress is visible in the dashboard and uses workspace-specific data.
- The product clearly separates demo/test investigations from real customer incidents.
- Empty states explain the value and the next action, not just that data is missing.
- The setup guide includes copyable API/webhook examples that use the user's real workspace key and API URL.
- Playwright covers signup -> setup checklist -> demo investigation -> report review.

## Phase 31: Demo-Quality Evidence Retrieval

Definition of done:

- GitHub evidence retrieval is targeted enough to avoid broad search overflow on normal repositories.
- Deploy/build evidence can ingest direct log text, commit SHA, service name, and failed command from an alert or webhook.
- Code search tools use scoped paths, pagination, and result limits instead of failing on large repositories.
- When observability backends are missing, the report still produces useful code/deploy reasoning instead of only low-confidence setup gaps.
- Evidence gaps distinguish "not configured", "configured but query failed", "query returned nothing", and "result too large".
- The dashboard evidence inspector shows enough source context for a customer to trust each cited claim.
- A clean demo incident proves GitHub/deploy evidence improves the final verdict and confidence.
- Tests cover large search results, missing credentials, direct deploy log payloads, and evidence-gap classification.

## Phase 32: Report, Replay, and Sharing Maturity

Definition of done:

- The report page reads like a customer-ready incident review document, not an internal debug artifact.
- Every major claim has clickable citations into the evidence inspector.
- Dissent is summarized plainly with impact on confidence and required follow-up.
- Recommended fixes are separated into immediate action, verification action, and long-term prevention.
- Read-only replay makes the event sequence understandable without exposing raw agent internals by default.
- Reports can be copied or exported in a shareable format suitable for Slack, email, or postmortem notes.
- Re-run with feedback is either implemented safely or explicitly disabled with clear copy.
- Tests cover report rendering, citation navigation, export/copy behavior, and replay readability.

## Phase 33: Operator Reliability and Support Console

Definition of done:

- Operators can see workspace health, failed workflow runs, stuck investigations, cost, and recent errors.
- Failed or stuck investigations can be retried, cancelled, or marked resolved through controlled admin actions.
- Worker/API/dashboard health is visible from one operator view.
- Inngest run IDs, investigation IDs, workspace IDs, and relevant request IDs are linked for troubleshooting.
- Customer-facing errors have corresponding operator-level diagnostics.
- Support docs explain how to debug signup, API key, integration, workflow, and dashboard display problems.
- Tests cover retry/cancel/disable controls and prevent cross-workspace admin leakage.

## Phase 34: First Customer Acceptance Gate

Definition of done:

- A first customer can complete the full journey without developer hand-holding:
  - landing page,
  - signup,
  - workspace,
  - setup,
  - API key,
  - GitHub integration,
  - first incident,
  - report review,
  - evidence inspection,
  - share/export.
- The dashboard has no obvious visual instability in the main workflow.
- Known limitations are visible before the customer relies on the product.
- The pitch, demo, and product behavior match; no important claim exists only in marketing copy.
- Launch smoke tests run against the hosted deployment after every release candidate.
- A release checklist records env vars, migrations, Inngest sync, smoke result, dashboard URL, API URL, and rollback path.
- The phase ends with a go/no-go note for selling to the first customer.

## Cut Order

If scope gets too large, cut in this order:

1. Branching replay.
2. Code Expert.
3. Real Mastra failure dataset.
4. Public hosted demo.

Do not cut:

- Counsel.
- Critic with inspection tools.
- Eval harness.
- OTel instrumentation.
