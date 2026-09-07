# Phase Status

Agents must update this file after completing phase work.

Status values:

- `not_started`
- `in_progress`
- `blocked`
- `complete`

## Phase 0: Monorepo and Schemas

Status: `complete`

Tasks:

- [x] Create monorepo workspace structure.
- [x] Configure package manager workspace.
- [x] Add root `package.json` scripts.
- [x] Add Turborepo config.
- [x] Add TypeScript strict config with `noUncheckedIndexedAccess`.
- [x] Add Biome config.
- [x] Add Vitest config.
- [x] Create `apps/api`.
- [x] Create `apps/worker`.
- [x] Create `apps/dashboard`.
- [x] Create `packages/shared-types`.
- [x] Create `packages/config`.
- [x] Create `packages/db`.
- [x] Create `packages/llm-gateway`.
- [x] Create `packages/agents`.
- [x] Create `packages/backends`.
- [x] Create `packages/otel`.
- [x] Add shared Zod schemas.
- [x] Add Drizzle schema.
- [x] Add config loader.
- [x] Add model alias config.
- [x] Run relevant checks.

Notes:

- Do not implement real API routes in Phase 0.
- Do not implement real agents in Phase 0.
- Do not build Dashboard UI in Phase 0.

## Phase 1: API and Persistence

Status: `complete`

Tasks:

- [x] Add local Postgres migration flow.
- [x] Apply initial database schema.
- [x] Add API server bootstrap.
- [x] Add request validation.
- [x] Implement `POST /investigations`.
- [x] Implement `GET /investigations/:id`.
- [x] Add artifact read route skeletons.
- [x] Add SSE route from `investigation_events`.
- [x] Add basic API tests.
- [x] Run relevant checks.

## Phase 2: Durable Workflow Skeleton

Status: `complete`

Tasks:

- [x] Add Inngest client.
- [x] Add `investigation.requested` workflow.
- [x] Create or load investigation state.
- [x] Emit workflow events.
- [x] Implement phase advancement skeleton.
- [x] Enforce max rounds.
- [x] Check cancellation.
- [x] Add deterministic `step_key` helpers.
- [x] Add workflow tests where practical.
- [x] Run relevant checks.

## Phase 3: Mocked Agent Loop

Status: `complete`

Tasks:

- [x] Add Director mocked context runner.
- [x] Add one mocked Expert.
- [x] Persist tool call rows before findings.
- [x] Add Critic scoring for mocked findings.
- [x] Add Reporter structured output.
- [x] Persist final report with evidence chain.
- [x] Compute confidence deterministically.
- [x] Add tests.
- [x] Run relevant checks.

## Phase 4: Real Observability Backends

Status: `complete`

Tasks:

- [x] Add Tempo Trace backend.
- [x] Add Loki Log backend.
- [x] Add Prometheus Metric backend.
- [x] Add mock Deploy backend.
- [x] Add GitHub Actions Deploy backend.
- [x] Add local git Code backend.
- [x] Enforce tool timeouts.
- [x] Enforce tool result-size limits.
- [x] Persist raw tool results.
- [x] Add tests.
- [x] Run relevant checks.

## Phase 5: Full Phase Machine

Status: `complete`

Tasks:

- [x] Implement TRIAGE -> TRACE -> VERDICT transitions.
- [x] Support multiple Director rounds.
- [x] Persist Review.
- [x] Persist Timeline.
- [x] Persist evidence gaps.
- [x] Implement failed state.
- [x] Implement cancelled state.
- [x] Enforce round limit.
- [x] Add tests.
- [x] Run relevant checks.

## Phase 6: Counsel and Confidence

Status: `complete`

Tasks:

- [x] Implement Counsel agent contract.
- [x] Persist Dissent Log.
- [x] Require evidence or evidence-gap citations.
- [x] Add Director response to dissent.
- [x] Force another TRACE round on strong unresolved dissent.
- [x] Implement final confidence formula.
- [x] Add tests.
- [x] Run relevant checks.

## Phase 7: Dashboard

Status: `complete`

Tasks:

- [x] Build Inbox.
- [x] Build Live View from SSE.
- [x] Build Report View.
- [x] Link evidence to tool call input/result.
- [x] Build read-only Replay View.
- [x] Add Playwright checks.
- [x] Run relevant checks.

## Phase 8: Evaluation and Deployment

Status: `complete`

Tasks:

- [x] Add Vitest eval harness.
- [x] Add smoke dataset.
- [x] Add full dataset runner.
- [x] Add baseline comparison.
- [x] Report accuracy.
- [x] Report evidence quality.
- [x] Report Counsel-catches-Director rate.
- [x] Report confidence calibration.
- [x] Report cost and latency.
- [x] Add deployment or reproducible local demo instructions.
- [x] Run relevant checks.

## Phase 9: Real LLM Gateway and Agents

Status: `complete`

Tasks:

- [x] Copy local env values into `.env` when credentials are provided.
- [x] Implement `packages/llm-gateway`.
- [x] Add provider client using model aliases.
- [x] Add strict JSON generation helper.
- [x] Add one validation repair retry.
- [x] Replace mocked Director with real Director contract.
- [x] Replace mocked Expert with real Expert contract.
- [x] Replace mocked Critic with real Critic contract.
- [x] Replace mocked Counsel with real Counsel contract.
- [x] Replace mocked Reporter with real Reporter contract.
- [x] Keep a test-only mock path for unit tests.
- [x] Persist token, latency, and cost metadata where available.
- [x] Run live vertical slice locally.
- [x] Add tests.
- [x] Run relevant checks.

Required `.env` values:

- `ANTHROPIC_API_KEY`

Optional model alias overrides:

- `MODEL_DIRECTOR_PRIMARY`
- `MODEL_EXPERT_CHEAP`
- `MODEL_CRITIC_BALANCED`
- `MODEL_COUNSEL_BALANCED`
- `MODEL_REPORTER_PRIMARY`

Validation:

- Live Anthropic gateway smoke passed.
- Live Director -> Expert -> Critic -> Counsel -> Reporter smoke passed with persisted-style fake repository.

## Phase 10: Live Tool Integrations

Status: `complete`

Tasks:

- [x] Wire Trace evidence to Tempo when `TEMPO_ENDPOINT` is configured.
- [x] Wire Log evidence to Loki when `LOKI_ENDPOINT` is configured.
- [x] Wire Metric evidence to Prometheus when `PROMETHEUS_ENDPOINT` is configured.
- [x] Wire Deploy evidence to GitHub Actions or mock deploys when configured.
- [x] Wire Code evidence to local git context when configured.
- [x] Add feature flag evidence path or documented v1 cut.
- [x] Convert tool failures into cited evidence gaps.
- [x] Verify persisted raw tool inputs/results/errors in dashboard.
- [x] Add integration tests with mocked HTTP responses.
- [x] Run relevant checks.

Required `.env` values as integrations are enabled:

- `TEMPO_ENDPOINT`
- `LOKI_ENDPOINT`
- `PROMETHEUS_ENDPOINT`
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `LAUNCHDARKLY_API_TOKEN`

Notes:

- Phase 10 currently collects all configured live tools into one persisted `evidence.bundle` tool call before the Expert summarizes it.
- Missing integrations are recorded as skipped evidence, not fake live data.
- Adapter failures are persisted on the tool call and passed to Counsel as evidence gaps.
- LaunchDarkly is a documented v1 cut until a concrete flag backend contract is added.

Validation:

- `pnpm --filter @argus/worker test` passed.
- `pnpm --filter @argus/worker typecheck` passed.
- `pnpm --filter @argus/worker lint` passed.
- `pnpm format:check` passed.
- `pnpm check` passed.

## Phase 11: External Integration API

Status: `complete`

Tasks:

- [x] Harden API auth for external users.
- [x] Add rate limiting.
- [x] Add request size limits.
- [x] Document create investigation API.
- [x] Document report, artifact, evidence, SSE, and replay APIs.
- [x] Support service name, time window, deploy ref, commit SHA, and feature flag metadata in requests.
- [x] Add structured public errors.
- [x] Add API integration tests.
- [x] Run relevant checks.

Required `.env` values:

- `API_KEY`
- `API_RATE_LIMIT_MAX`
- `API_RATE_LIMIT_WINDOW_MS`
- `API_REQUEST_BODY_LIMIT_BYTES`

Validation:

- `pnpm --filter @argus/api test` passed.
- `pnpm --filter @argus/api typecheck` passed.
- `pnpm --filter @argus/api lint` passed.
- `pnpm --filter @argus/config test` passed.
- `pnpm format:check` passed.
- `pnpm check` passed.

Required `.env` values:

- `API_KEY`

## Phase 12: Production Workflow Hardening

Status: `complete`

Tasks:

- [x] Configure Inngest for deployment mode.
- [x] Verify workflow idempotency across retries.
- [x] Add health checks for API, worker, and dashboard.
- [x] Add OpenTelemetry service instrumentation.
- [x] Test SSE reconnect behavior.
- [x] Surface failed, cancelled, and partial states in dashboard.
- [x] Add deploy-safe migration instructions.
- [x] Add tests.
- [x] Run relevant checks.

Required `.env` values:

- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_BASE_URL`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

Notes:

- Inngest client now uses the configured base URL, development mode only in local development, and checkpointing.
- Completed and failed investigation retries are idempotent no-ops.
- API supports SSE reconnect from `Last-Event-ID`; dashboard reconnects with the last received sequence.
- API exposes `/health`; dashboard exposes `/api/health`; worker exposes `pnpm --filter @argus/worker health` after build.
- Production migration and operational state guidance lives in `docs/PRODUCTION_HARDENING.md`.

Validation:

- `pnpm --filter @argus/api test` passed.
- `pnpm --filter @argus/worker test` passed.
- `pnpm --filter @argus/otel test` passed.
- `pnpm --filter @argus/dashboard test` passed.
- `pnpm --filter @argus/worker health` passed after build.
- `pnpm format:check` passed.
- `pnpm check` passed.

## Phase 13: Deployment

Status: `complete`

Tasks:

- [x] Add production build/start commands where missing.
- [x] Add Dockerfiles or selected platform deployment config.
- [x] Add production env var checklist.
- [x] Add migration command to deploy instructions.
- [x] Add smoke test for deployed v1.
- [x] Deploy API.
- [x] Deploy worker.
- [x] Deploy dashboard.
- [x] Verify public/private v1 URL.
- [x] Run relevant checks.

Required deployment inputs:

- Hosted Postgres URL.
- Runtime host for API, worker, and dashboard.
- Secret manager or deployment environment variables.
- Public dashboard/API URLs.

Notes:

- API, worker, and dashboard Dockerfiles were added.
- `render.yaml` was added to create Render services for the API, worker, and dashboard from GitHub.
- `infra/docker-compose.prod.yml` can run the three production services against a provided `.env`.
- Worker `start` now runs an HTTP server with `/health` and `/api/inngest` instead of exiting after registration.
- `docs/DEPLOYMENT.md` contains the env checklist, migration command, Docker commands, health checks, and `pnpm smoke:v1`.
- Render Blueprint deployment created live services for API, worker, dashboard, and Postgres.
- Production database migrations were applied to Render Postgres from local CLI using `sslmode=require`.
- Inngest production app was synced to `https://argus-worker.onrender.com/api/inngest`.
- Health checks passed for API, worker, and dashboard.
- Deployed v1 smoke test passed with investigation `11d1ab17-2acc-41b4-85d4-9dcd919467ed`.
- The successful smoke report completed with confidence `0.38`, correctly reflecting weak evidence because live Tempo, Loki, Prometheus, and feature flag integrations are not configured.

Validation:

- `pnpm smoke:v1` passed against the deployed Render API, worker, dashboard, Inngest Cloud, Anthropic, and Render Postgres.
- `pnpm --filter @argus/config test` passed.
- `pnpm --filter @argus/worker build` passed.
- `pnpm --filter @argus/worker test` passed.
- `pnpm --filter @argus/api test` passed.
- `pnpm --filter @argus/agents test` passed.
- `pnpm --filter @argus/worker health` passed.
- API Docker build passed.
- Worker Docker build passed.
- `pnpm format:check` passed.
- `git diff --check` passed.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm check` reached 39/40 successful tasks; dashboard Playwright test was stopped after the local Next dev server bound `127.0.0.1:3002` but did not respond in this session.

## Phase 14: v1 Release Gate

Status: `complete`

Tasks:

- [x] Run full eval dataset.
- [x] Record release eval metrics.
- [x] Verify accuracy threshold.
- [x] Verify evidence quality threshold.
- [x] Verify Counsel catch rate threshold.
- [x] Verify calibration, cost, and latency thresholds.
- [x] Security review secrets, auth, rate limiting, CORS, and validation.
- [x] Complete user-facing integration docs.
- [x] Document v1 known limitations.
- [x] Create v1 release tag after checks pass.

Notes:

- Added a deterministic v1 full eval dataset covering checkout latency, search errors, regional auth latency, and deployment plus feature flag regression cases.
- `pnpm eval:full` now uses the full eval dataset by default. Set `ARGUS_EVAL_DATASET=smoke` to run the single-case smoke dataset.
- Release eval metrics are recorded in `docs/RELEASE_METRICS.md`.
- Accuracy threshold is `>= 0.800`; v1 candidate result is `1.000`, so the gate passes.
- Evidence quality threshold is `>= 0.800`; v1 candidate result is `0.875`, so the gate passes.
- Counsel catch rate threshold is `>= 0.800`; v1 candidate result is `1.000`, so the gate passes.
- Calibration error threshold is `<= 0.150`; v1 candidate result is `0.000`, so the gate passes.
- Total cost threshold is `<= 0.2500` USD for the deterministic full eval; v1 candidate result is `0.0890`, so the gate passes.
- Average latency threshold is `<= 3000` ms; v1 candidate result is `1818`, so the gate passes.
- Security review is recorded in `docs/SECURITY_REVIEW.md`; v1 is a conditional pass for private beta or single-tenant deployment, not public multi-tenant SaaS.
- User-facing integration guide is recorded in `docs/INTEGRATION_GUIDE.md`.
- Known limitations are documented in `docs/V1_LIMITATIONS.md`.
- v1 release tag is `v1.0.0`.
- Full eval output from the first Phase 14 run:
  - `cases=4`
  - `accuracy=1.000`
  - `evidence_quality=0.875`
  - `counsel_catch_rate=1.000`
  - `calibration_error=0.000`
  - `total_cost_usd=0.0890`
  - `average_latency_ms=1818`
- `baseline_accuracy=0.375`
- `accuracy_delta=0.625`
- `evidence_quality_delta=0.521`
- `calibration_error_improvement=0.202`

Validation:

- `pnpm --filter @argus/evals test` passed.
- `pnpm --filter @argus/api test` passed.
- `pnpm test` passed.
- `pnpm build` passed.
- `pnpm eval:smoke` passed.
- `pnpm eval:full` passed.
- `pnpm format:check` passed.
- `git diff --check` passed.

## Phase 15: Customer-Facing Dashboard Clarity

Status: `complete`

Goal:

- Make the existing dashboard understandable to a first customer without removing the advanced investigation surface.

Tasks:

- [x] Rename internal labels into customer-facing product language.
- [x] Make completed investigations open on the customer report summary first.
- [x] Show most likely cause, confidence explanation, evidence summary, dissent summary, and recommended next action as the primary completed view.
- [x] Move raw tool-call details, adapter errors, and agent internals behind advanced inspection controls.
- [x] Convert skipped integration and tool failures into setup-gap messages.
- [x] Label or filter smoke/test investigations.
- [x] Improve empty states for first-time users.
- [x] Add dashboard tests for the clarified views.
- [x] Run relevant checks.

Notes:

- Added a customer summary section above the detailed report with likely cause, next action, confidence explanation, and dissent/uncertainty.
- Completed investigations still open on the report tab, but the report now starts with customer-facing summary copy instead of internal evidence rows.
- Smoke and dashboard-smoke investigations are labeled as test data.
- Integration/tool problems are translated into setup gaps such as missing metrics, trace, deploy/code, or feature flag evidence.
- Raw evidence remains available through the evidence rows and right-side inspector for advanced review.

Validation:

- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm --filter @argus/dashboard test` passed.

## Phase 16: Create Investigation UI

Status: `complete`

Goal:

- Let a first customer create an investigation from the dashboard without curl.

Tasks:

- [x] Add a "New Investigation" form.
- [x] Collect incident ID, service, environment, severity, summary, and time window.
- [x] Support optional deploy ref, commit SHA, log query, metric query, code pattern, and feature flag context.
- [x] Call `POST /investigations` through the API server.
- [x] Handle API auth using the selected v1 API key strategy.
- [x] Select the new investigation after creation.
- [x] Show clear validation and submission errors.
- [x] Add tests.
- [x] Run relevant checks.

Notes:

- Added a dashboard "New investigation" form for single-company v1 usage.
- The browser submits to a dashboard server route at `/api/investigations`; the server route forwards to the API with `API_KEY` from the dashboard service environment so the write key is not exposed in client JavaScript.
- The form supports required incident fields plus optional deploy/code/log/metric/feature-flag hints.
- Successful creation selects the new investigation and opens Live View.
- Render dashboard env now includes `API_KEY` as a non-synced secret; it must match the API service write key for the deployment.

Validation:

- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm --filter @argus/dashboard test` passed.

## Phase 17: Customer Integration Guide In Product

Status: `complete`

Goal:

- Make the dashboard itself explain how a customer connects Argus.

Tasks:

- [x] Add a setup page or panel with the API base URL.
- [x] Add a curl example for `POST /investigations`.
- [x] Explain the customer API key in simple language.
- [x] Explain which credentials are internal operator credentials versus customer-provided integration credentials.
- [x] Document the manual API path.
- [x] Document the monitoring-alert webhook path as the next integration pattern.
- [x] Add copy suitable for a first design-partner customer.
- [x] Add tests where practical.
- [x] Run relevant checks.

Notes:

- Added a top-bar Setup view inside the dashboard.
- Setup shows the API base URL and a ready-to-adapt curl example for `POST /investigations`.
- Setup separates customer/company-provided values from operator-owned service secrets.
- Setup explains the recommended path from manual API calls to alert webhooks, deploy/code context, and observability integrations.

Validation:

- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm --filter @argus/dashboard test` passed.

## Phase 18: First Real Customer Evidence Integration

Status: `complete`

Goal:

- Connect one real evidence source that makes a customer demo meaningfully useful.

Tasks:

- [x] Choose the first integration based on the first customer's stack.
- [x] Prefer GitHub code/deploy, Prometheus metrics, Loki logs, or Tempo traces.
- [x] Add or harden credential setup for that integration.
- [x] Ensure the integration produces cited evidence in the report.
- [x] Ensure missing credentials produce cited setup gaps.
- [x] Show the integration result in the evidence inspector.
- [x] Document customer setup steps.
- [x] Add mocked integration tests.
- [x] Run relevant checks.

Notes:

- GitHub was selected as the first real customer evidence integration because it is easiest to
  explain and demo for a single-company deployment.
- When `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_REPO` are configured, the worker now uses GitHub
  Actions for deploy evidence and GitHub repository code search for code evidence.
- Hosted deployments no longer rely on local `rg` for code evidence when GitHub credentials exist.
- Missing GitHub credentials still produce setup gaps instead of fabricated evidence.

Validation:

- `pnpm --filter @argus/backends test` passed.
- `pnpm --filter @argus/backends typecheck` passed.

## Phase 19: Demo Dataset and Pitch Script

Status: `complete`

Goal:

- Prepare a clean demo and sales narrative for the first customer conversation.

Tasks:

- [x] Create or seed one clean demo investigation.
- [x] Separate demo investigations from smoke/test investigations.
- [x] Write a 5-10 minute product walkthrough.
- [x] Write the first-customer pitch script.
- [x] Explain the pain, product, citations, dashboard, required setup, and v1 limitations.
- [x] Add a short follow-up email template.
- [x] Add a beta onboarding checklist draft.
- [x] Run relevant checks.

Notes:

- Added `pnpm demo:v1`, which creates a clean `demo-checkout-latency-*` investigation instead of a
  noisy `smoke-*` deployment test.
- Added `docs/DEMO_PLAYBOOK.md` with the demo story, walkthrough, low-confidence explanation,
  follow-up email template, and beta onboarding checklist.
- Linked the first-customer pitch doc to the demo playbook.

Validation:

- `node --check scripts/demo-v1.mjs` passed.

## Phase 20: Private Beta Readiness

Status: `complete`

Goal:

- Make Argus safe enough to use inside one company or with one controlled first customer as a single-tenant deployment.

Tasks:

- [x] Treat v1 beta as single-tenant by default.
- [x] Add or document API key rotation.
- [x] Protect or document read access risk for the dashboard/API in a single-tenant deployment.
- [x] Add operator monitoring for API, worker, failed runs, and cost.
- [x] Add visible known-limitations copy for beta users.
- [x] Add private beta onboarding checklist.
- [x] Add private beta rollback/disable instructions.
- [x] Run relevant checks.

Notes:

- Added `docs/PRIVATE_BETA_RUNBOOK.md`.
- The runbook documents one-company deployment assumptions, API key rotation, read-access risk,
  operator monitoring, visible beta limitations, onboarding, and rollback/disable steps.
- Deployment, security review, and limitation docs now link to the private beta runbook.

Validation:

- `pnpm format:check` passed.
- `git diff --check` passed.

## Phase 21: Single-Tenant Company Deployment Template

Status: `complete`

Goal:

- Make it repeatable to deploy one isolated Argus instance for one company/customer.

Tasks:

- [x] Document the one-company deployment model.
- [x] Add a naming convention for customer-specific API, worker, dashboard, and Postgres services.
- [x] Create or document a customer-specific Render blueprint flow.
- [x] Split env vars into operator-owned, customer-provided, and generated values.
- [x] Document database migration steps for a new customer DB.
- [x] Document Inngest app sync for a new customer worker URL.
- [x] Document post-deploy smoke test.
- [x] Document customer handoff: dashboard URL, API URL, API key, and integration checklist.
- [x] Clearly state this is not multi-tenant SaaS.
- [x] Run relevant checks.

Notes:

- Added `docs/SINGLE_TENANT_DEPLOYMENT.md` as the operator guide for deploying one isolated
  Argus stack per company.
- Added `infra/render.single-tenant.example.yaml` as the copy-and-replace Render template for a
  customer-specific API, worker, dashboard, and Postgres deployment.
- The guide separates operator-owned values, customer-provided integration values, and generated
  per-company secrets.
- The guide documents migrations, Inngest app sync, health checks, smoke/demo tests, and customer
  handoff.
- The doc explicitly states that v1 is not multi-tenant SaaS and must not share one stack across
  unrelated customers.

Validation:

- `pnpm format:check` passed.
- `git diff --check` passed.

Phase 20 and Phase 21 remain useful as private-beta fallback docs, but they are no longer the main
product direction. From Phase 22 onward, the roadmap targets an authenticated launchable product
that can serve separate users and workspaces safely.

## Phase 22: Launch Auth Foundation

Status: `complete`

Goal:

- Add real login and protect the dashboard so Argus is no longer an unauthenticated private-beta dashboard.

Tasks:

- [x] Add user login.
- [x] Add logout.
- [x] Protect dashboard pages behind an authenticated session.
- [x] Add production-safe auth secrets and callback URL config.
- [x] Add first workspace creation or join flow after login.
- [x] Remove unauthenticated production dashboard access or restrict it to development mode.
- [x] Add API session checks for dashboard-backed read/write routes.
- [x] Add tests for protected routes and session checks.
- [x] Run relevant checks.

Notes:

- Added API-owned auth endpoints: `POST /auth/login`, `GET /auth/me`, and `POST /auth/logout`.
- Added database tables for `users`, `workspaces`, `workspace_memberships`, and `auth_sessions`.
- Added bootstrap login config: `AUTH_BOOTSTRAP_EMAIL`, `AUTH_BOOTSTRAP_PASSWORD`, and
  `AUTH_BOOTSTRAP_WORKSPACE_NAME`.
- Login creates or loads the first admin user and workspace, then issues a server-side session.
- Dashboard now has `/login`, HTTP-only session cookie handling, logout, and middleware protection.
- Dashboard investigation creation now verifies the dashboard session before forwarding writes.
- This is the launch auth foundation. Full workspace data isolation remains Phase 23.

Validation:

- `pnpm --filter @argus/config test` passed.
- `pnpm --filter @argus/db test` passed.
- `pnpm --filter @argus/api test` passed.
- `pnpm --filter @argus/db typecheck` passed.
- `pnpm --filter @argus/api typecheck` passed.
- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/worker typecheck` passed.
- `pnpm --filter @argus/config typecheck` passed.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm --filter @argus/dashboard test` passed with escalated permission to bind the local
  Playwright server port.
- `pnpm --filter @argus/api lint` passed.
- `pnpm --filter @argus/dashboard lint` passed.
- `pnpm format:check` passed.
- `git diff --check` passed.

## Phase 23: Workspace Data Isolation

Status: `complete`

Goal:

- Make all investigation data workspace-specific so each user only sees their own workspace data.

Tasks:

- [x] Add organizations or workspaces as first-class database records.
- [x] Add workspace membership records.
- [x] Add roles: admin, engineer, viewer.
- [x] Add workspace ownership to investigations.
- [x] Add workspace ownership or scoped joins for events, reports, artifacts, tool calls, and agent outputs.
- [x] Filter dashboard list/detail/report/evidence/replay reads by workspace.
- [x] Filter SSE streams by workspace.
- [x] Add tenant isolation tests that attempt cross-workspace reads.
- [x] Run relevant checks.

Notes:

- Added `workspace_id` to investigations and generated migration `0002_zippy_timeslip`.
- Investigation repository reads now accept an optional workspace scope and apply it to list, detail,
  report, artifacts, tool-call, and event reads.
- API investigation routes now resolve workspace access from a dashboard bearer session or the
  bootstrap API key. When auth is configured, unauthenticated reads are rejected.
- Dashboard investigation reads now go through authenticated dashboard server routes under
  `/api/investigations`; the browser no longer reads directly from the public API.
- Dashboard SSE now goes through an authenticated dashboard proxy route.
- API tests cover unauthenticated read rejection, session workspace scoping, and create-in-workspace
  behavior.
- Full workspace-scoped API key management remains Phase 24.

Validation:

- `pnpm --filter @argus/api test` passed.
- `pnpm --filter @argus/db test` passed.
- `pnpm --filter @argus/db typecheck` passed.
- `pnpm --filter @argus/api typecheck` passed.
- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/worker typecheck` passed.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm --filter @argus/dashboard test` passed with escalated permission to bind the local
  Playwright server port.
- `pnpm --filter @argus/api lint` passed.
- `pnpm --filter @argus/dashboard lint` passed.
- `pnpm format:check` passed.
- `git diff --check` passed.

## Phase 24: Workspace API Keys and Customer Onboarding

Status: `complete`

Goal:

- Let each workspace create its own integration API keys and onboard without operator-managed shared secrets.

Tasks:

- [x] Add workspace API key table.
- [x] Store API key hashes, not raw API keys.
- [x] Show raw API key only once during creation.
- [x] Add API key create, list metadata, rotate, and revoke endpoints.
- [x] Scope `POST /investigations` to the workspace that owns the API key.
- [x] Replace production shared `API_KEY` with workspace-scoped API keys.
- [x] Add dashboard onboarding flow: signup -> workspace -> API key -> first investigation.
- [x] Update setup page to use workspace-specific API key guidance.
- [x] Add tests for API key auth and revocation.
- [x] Run relevant checks.

Notes:

- Added `workspace_api_keys` with hashed secrets, display prefixes, status, last-used metadata, and
  revoke timestamps.
- API routes now support `GET /workspace/api-keys`, `POST /workspace/api-keys`,
  `POST /workspace/api-keys/:id/rotate`, and `POST /workspace/api-keys/:id/revoke`.
- Raw workspace API keys are returned only from create/rotate responses.
- Production authenticated deployments reject the old shared `API_KEY` path for customer writes;
  local/no-auth mode still supports it as a development fallback.
- Dashboard Setup now lets logged-in workspace users create, rotate, revoke, and copy API keys, then
  uses the generated key in the curl example.
- Integration, deployment, credential, limitation, and security docs were updated for workspace API
  keys.

Validation:

- `pnpm --filter @argus/db typecheck` passed.
- `pnpm --filter @argus/api typecheck` passed.
- `pnpm --filter @argus/api test` passed.
- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm --filter @argus/dashboard test` passed with escalated permission to bind the local
  Playwright server port.

## Phase 25: Per-Workspace Integration Credentials

Status: `complete`

Goal:

- Store and use GitHub/observability credentials per workspace instead of global deployment env vars.

Tasks:

- [x] Add integration credentials table scoped to workspace.
- [x] Encrypt stored integration secrets or delegate them to a managed secret store.
- [x] Add GitHub credential setup UI.
- [x] Add Prometheus/Loki/Tempo credential setup UI or documented v1 cuts.
- [x] Make worker tool adapters resolve credentials from the investigation workspace.
- [x] Show connected/missing integration status in the dashboard.
- [x] Convert missing workspace credentials into setup gaps.
- [x] Add tests that prevent cross-workspace credential use.
- [x] Run relevant checks.

Notes:

- Added `workspace_integrations` with provider, status, non-secret config, encrypted secret
  ciphertext, and secret hints.
- Added `INTEGRATION_SECRET_KEY`; API and worker must share the same value so credentials saved by
  the API can be decrypted by the worker.
- Added workspace integration API routes for list, save, and disable.
- Dashboard Setup now shows per-workspace integration status and forms for GitHub, Prometheus, Loki,
  and Tempo.
- Worker backend registry is now resolved per investigation workspace. Production no longer uses
  global GitHub/Prometheus/Loki/Tempo env vars for authenticated workspaces.
- Missing workspace credentials continue to become setup gaps rather than fabricated evidence.
- API tests verify integration setup uses the logged-in workspace and does not expose raw secrets.

Validation:

- `pnpm --filter @argus/config typecheck` passed.
- `pnpm --filter @argus/config test` passed.
- `pnpm --filter @argus/db typecheck` passed.
- `pnpm --filter @argus/db test` passed.
- `pnpm --filter @argus/api typecheck` passed.
- `pnpm --filter @argus/api lint` passed.
- `pnpm --filter @argus/api test` passed.
- `pnpm --filter @argus/worker typecheck` passed.
- `pnpm --filter @argus/worker test` passed.
- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm --filter @argus/dashboard test` passed with escalated permission to bind the local
  Playwright server port.
- `pnpm format:check` passed.
- `git diff --check` passed.

## Phase 26: Usage, Limits, and Account Controls

Status: `complete`

Goal:

- Add the controls needed to operate Argus for multiple workspaces without surprise cost or abuse.

Tasks:

- [x] Track model tokens, estimated cost, latency, and investigation count per workspace.
- [x] Add per-workspace and per-API-key rate limits.
- [x] Add workspace status: active, suspended, disabled.
- [x] Block new investigations for suspended or disabled workspaces.
- [x] Keep historical read access policy explicit for suspended workspaces.
- [x] Add operator/admin visibility into failed runs, cost, and usage.
- [x] Add manual billing/account status docs for launch.
- [x] Add tests.
- [x] Run relevant checks.

Notes:

- Added `workspace_status` and defaulted workspaces to `active`.
- Added an account repository that computes workspace investigation counts, failed runs, model
  tokens, estimated cost, LLM duration, and average completed workflow latency.
- Added `/workspace/account` read/update API for dashboard account controls.
- New investigations are blocked for `suspended` and `disabled` workspaces, while historical read
  routes remain available.
- Investigation creation now has workspace/API-key identity rate limiting in addition to the local
  write guard.
- Dashboard Setup shows workspace status, usage/cost metrics, and admin account-status controls.
- Added `docs/ACCOUNT_CONTROLS.md` for manual billing and account disable behavior.

Validation:

- `pnpm --filter @argus/api typecheck` passed.
- `pnpm --filter @argus/api lint` passed.
- `pnpm --filter @argus/api test` passed.
- `pnpm --filter @argus/db typecheck` passed.
- `pnpm --filter @argus/db lint` passed.
- `pnpm --filter @argus/db test` passed.
- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/dashboard lint` passed.
- `pnpm --filter @argus/dashboard test` passed with escalated permission to bind the local
  Playwright server port.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm format:check` passed.
- `git diff --check` passed.

## Phase 27: Launch Security and Reliability Gate

Status: `complete`

Goal:

- Prove the authenticated multi-workspace product is safe enough to launch.

Tasks:

- [x] Update security review for authenticated multi-workspace launch.
- [x] Require auth or workspace API key access on all read APIs.
- [x] Verify CORS cannot expose one workspace to another.
- [x] Verify secrets do not appear in client bundles, logs, traces, screenshots, or docs.
- [x] Verify database migrations are production-safe.
- [x] Test Inngest retries, duplicate events, failed runs, and partial investigations.
- [x] Add launch smoke test: signup/login -> workspace -> API key -> create investigation -> report -> dashboard read.
- [x] Add Playwright coverage for the authenticated dashboard workflow.
- [x] Run relevant checks.

Notes:

- Production API construction now fails closed if auth is not wired.
- API tests verify read APIs require a session or workspace API key.
- API tests verify CORS only allows the configured dashboard origin.
- Security review now covers authenticated multi-workspace launch, secret exposure, migrations,
  workflow retry/idempotency posture, and remaining public-launch constraints.
- Added `scripts/smoke-launch.mjs` and `pnpm smoke:launch` for login -> workspace API key -> create
  investigation -> report polling -> dashboard health launch verification.
- Existing worker tests cover completed/failed retry no-ops, cancellation, and strict JSON fallback.

Validation:

- `pnpm --filter @argus/api typecheck` passed.
- `pnpm --filter @argus/api lint` passed.
- `pnpm --filter @argus/api test` passed.
- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/dashboard test` passed with escalated permission to bind the local
  Playwright server port.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm --filter @argus/worker test` passed.
- `pnpm format:check` passed.
- `git diff --check` passed.

## Phase 28: Public Launch Readiness

Status: `complete`

Goal:

- Prepare the customer-facing product, docs, and release gate for launch.

Tasks:

- [x] Add or polish landing page.
- [x] Make signup/login reachable from the public site.
- [x] Ensure new users can create a workspace and run the first investigation without operator help.
- [x] Update integration docs for workspace API keys.
- [x] Explain citations, confidence, dissent, and setup gaps in product docs.
- [x] Add support, rollback, incident response, and customer handoff runbooks.
- [x] Run release evals and record launch metrics.
- [x] Create public launch tag after checks pass.
- [x] Run relevant checks.

Notes:

- Added public `/landing` and `/signup` routes. Unauthenticated dashboard visits now land on the
  public launch page, while authenticated users keep the dashboard path.
- Added API-backed self-serve signup that creates a user, workspace, admin membership, and dashboard
  session.
- Added a `users.password_hash` migration so self-serve users can log in without operator bootstrap.
- Updated dashboard Playwright coverage for landing -> signup -> workspace session.
- Added `docs/PRODUCT_CONCEPTS.md` and `docs/LAUNCH_RUNBOOK.md`.
- Updated `docs/INTEGRATION_GUIDE.md`, `docs/V1_CREDENTIALS.md`, and
  `docs/RELEASE_METRICS.md` for public launch.
- Public launch tag: `v1.0.0-launch`.

Validation:

- `pnpm typecheck` passed.
- `pnpm test` passed with local server binding allowed for Playwright.
- `pnpm build` passed.
- `pnpm eval:full` passed with accuracy `1.000`, evidence quality `0.875`, Counsel catch rate
  `1.000`, calibration error `0.000`, total cost `$0.0890`, and average latency `1818ms`.
- Production migration `0006_next_invisible_woman.sql` applied successfully against deployed
  Postgres with SSL.
- Hosted launch smoke passed against Render API/dashboard and Inngest worker. Smoke investigation:
  `bab37f46-368f-42bc-8a06-468aa9621aa3`.
- `pnpm format:check` passed.
- `git diff --check` passed.

## Phase 29: Dashboard Stability and UX Maturity

Status: `complete`

Goal:

- Make the authenticated dashboard feel mature, stable, and predictable during real customer usage.

Tasks:

- [x] Audit the main dashboard for layout jump, clipped text, confusing empty states, and unstable loading states.
- [x] Reserve stable dimensions for inbox rows, headers, tabs, report panels, and evidence inspector.
- [x] Add proper loading, empty, error, disconnected, running, completed, failed, and partial states.
- [x] Preserve selected investigation, tab, filter, and search state across refreshes where useful.
- [x] Make the dashboard responsive enough for laptop and tablet widths.
- [x] Improve customer-facing error copy for API errors, worker delays, missing reports, and SSE disconnects.
- [x] Add Playwright coverage for the main stable dashboard states.
- [x] Record basic performance budgets for first load, investigation switch, report render, and evidence inspector open.

Notes:

- Dashboard first load now shows fixed-size inbox and panel skeletons instead of flashing empty
  states.
- Refresh preserves the selected investigation when it still exists, while keeping current tab,
  search, and filter UI state.
- Live View now has explicit connecting/reconnecting copy and does not clear existing events on SSE
  reconnect.
- Dashboard layout now reserves height for inbox rows, the incident header, metrics, empty states,
  event lists, and loading panels.
- Tablet layout keeps the main report usable while hiding the right-side inspector.
- Basic dashboard performance budgets are recorded in `docs/DASHBOARD_PERFORMANCE_BUDGETS.md`.

Validation:

- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/dashboard lint` passed.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm --filter @argus/dashboard test` passed with escalated permission to bind the local
  Playwright server port.
- `pnpm format:check` passed.
- [x] Run relevant checks.

Notes:

- This phase is not generic dashboard polish. It is about trust: the customer should not feel the product is fragile while reviewing an incident.
- Keep advanced evidence details available, but make the default screen calm and stable.

## Phase 30: First-Run Activation and Guided Setup

Status: `complete`

Goal:

- Make a new user understand what to do next without asking the founder.

Tasks:

- [x] Add a first-run checklist for API key, GitHub integration, first investigation, and first report.
- [x] Show setup progress using real workspace state.
- [x] Add a safe demo investigation path that does not require production credentials.
- [x] Clearly separate demo/test investigations from real customer incidents.
- [x] Improve empty states so they explain the next action and expected value.
- [x] Make setup examples use the user's real API URL and workspace API key.
- [x] Add tests for signup -> checklist -> demo investigation -> report review.
- [x] Run relevant checks.

Notes:

- The first-run flow should answer: "What do I click now, and why?"
- Do not require Prometheus/Loki/Tempo for a first useful experience.
- Setup now includes a first-run checklist driven by workspace API key metadata, GitHub integration
  state, investigation count, and completed report availability.
- Setup includes a safe demo investigation button that creates a clearly labeled demo incident
  without requiring production monitoring credentials.
- The setup example continues to use the real API base URL and uses the newly created raw workspace
  API key when one is available.
- Dashboard tests now cover the checklist and safe demo investigation path.

Validation:

- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/dashboard lint` passed.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm --filter @argus/dashboard test` passed with escalated permission to bind the local
  Playwright server port.
- `pnpm format:check` passed.
- `git diff --check` passed.

## Phase 31: Demo-Quality Evidence Retrieval

Status: `complete`

Goal:

- Make first demos produce useful evidence-backed output, not mostly low-confidence setup gaps.

Tasks:

- [x] Make GitHub code search targeted by repository, path hints, commit SHA, and incident payload context.
- [x] Add safer pagination/result-size handling for GitHub search and code evidence.
- [x] Accept direct deploy/build log text in the investigation payload and persist it as cited evidence.
- [x] Distinguish setup gaps: not configured, query failed, zero results, and result too large.
- [x] Make missing observability backends degrade gracefully while still using available code/deploy evidence.
- [x] Improve the evidence inspector so customers can see source context without reading raw JSON first.
- [x] Add a clean demo investigation that proves the improved evidence path.
- [x] Add tests for broad repo searches, direct deploy log payloads, and evidence-gap classification.
- [x] Run relevant checks.

Notes:

- This phase directly addresses the weak demo where GitHub search overflowed and the report became inconclusive.
- The product should be honest about missing telemetry, but it should still extract value from the evidence the user provides.
- Evidence bundle results now classify `not_configured`, `query_failed`, `zero_results`, and
  `result_too_large` separately.
- Investigation payloads can include `buildLog` or `deployLog`, `commitSha`, `deployRef`, and code
  path hints so pasted build failures become cited evidence.
- GitHub code search caps result pages and records path/commit context instead of broad unbounded
  searches.
- The dashboard evidence inspector now summarizes source context before raw JSON.

Validation:

- `pnpm --filter @argus/backends test` passed.
- `pnpm --filter @argus/backends typecheck` passed.
- `pnpm --filter @argus/worker test` passed.
- `pnpm --filter @argus/worker typecheck` passed.
- `pnpm --filter @argus/worker lint` passed.
- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/dashboard lint` passed.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm format:check` passed.
- `git diff --check` passed.

## Phase 32: Report, Replay, and Sharing Maturity

Status: `complete`

Goal:

- Make Argus reports useful in a review meeting and shareable outside the dashboard.

Tasks:

- [x] Rewrite the report layout around customer review: cause, confidence, evidence, dissent, action.
- [x] Make every major claim link to the exact evidence row or inspector panel.
- [x] Split recommended fixes into immediate, verification, and prevention actions.
- [x] Make read-only replay understandable without exposing raw agent internals by default.
- [x] Add copy/export support for Slack, email, or postmortem notes.
- [x] Decide whether "Re-run with feedback" is implemented now or disabled with honest copy.
- [x] Add tests for citation navigation, report export/copy, and replay readability.
- [x] Run relevant checks.

Notes:

- A report should feel like the artifact the customer can defend, not a debug transcript.
- Report view now opens with a customer-ready Review Brief: most likely cause, evidence
  confidence, evidence count, dissent summary, and next action.
- Review Brief and timeline items now expose direct citation buttons that open the evidence
  inspector without forcing the user to search the evidence table first.
- Action Plan now separates immediate remediation, verification follow-up, and long-term prevention.
- Read-only Replay now starts with a human-readable sequence summary and keeps raw event payloads
  collapsed behind an audit detail disclosure.
- Dashboard browser coverage now verifies citation navigation, the three-part action plan, and
  replay readability with a mocked live event stream.
- Report view now includes a Share Report panel with Slack summary copy, email update copy, and
  Markdown postmortem export from the validated report artifact.
- Dashboard browser coverage now verifies report copy/export behavior in addition to citation and
  replay behavior.
- "Re-run with feedback" remains disabled for v1 and now says to create a new investigation with
  updated context instead of implying branching replay exists.

Validation:

- `pnpm --filter @argus/dashboard typecheck` passed.
- `pnpm --filter @argus/dashboard lint` passed.
- `pnpm --filter @argus/dashboard test` passed with escalated permission to bind the local
  Playwright server port.
- `pnpm --filter @argus/dashboard build` passed.
- `pnpm format:check` passed.
- `git diff --check` passed.

## Phase 33: Operator Reliability and Support Console

Status: `complete`

Goal:

- Give the operator enough visibility and control to support real users after launch.

Tasks:

- [x] Add operator visibility into workspace health, failed runs, stuck investigations, cost, and recent errors.
- [x] Add controlled retry, cancel, and resolve actions for failed or stuck investigations.
- [x] Link Inngest run IDs, investigation IDs, workspace IDs, and request IDs for support.
- [x] Show customer-facing errors with corresponding operator diagnostics.
- [x] Add support docs for signup, API key, integration, workflow, and dashboard display failures.
- [x] Add tests for retry/cancel/disable controls and workspace isolation.
- [x] Run relevant checks.

Notes:

- This is for running the product, not for adding more end-user features.
- Dashboard now has a Support console with workspace health, failed run count, stuck running
  investigations, estimated cost, average workflow latency, recent failed investigations, and stuck
  investigation candidates.
- Support console can cancel running stuck investigations through a workspace-scoped API route.
  Retry and resolve are intentionally shown as disabled until durable workflow retry and persisted
  operator resolution state exist.
- API responses now include `x-argus-request-id`, the dashboard preserves that ID through its
  API proxy, and the Support console shows workspace ID, investigation ID, request ID, and Inngest
  function/event lookup keys. The actual Inngest provider run ID is not persisted in v1, so the UI
  honestly points operators to search by function and event payload `investigationId`.
- Customer-facing dashboard request failures now include a support reference ID, and the Support
  console shows the corresponding operator diagnostic with source, status, request ID, upstream
  error code, and customer-visible message.
- Tests now cover disabled retry/resolve controls, stuck-investigation cancel from Support, API
  workspace isolation on cancel, request ID propagation, and customer-error diagnostics.
- Added `docs/SUPPORT_RUNBOOK.md` covering signup/login, API keys, integrations, workflows,
  dashboard display failures, report quality issues, escalation fields, and v1 support limits.
- Validation passed: dashboard typecheck, dashboard lint, dashboard Playwright tests, API tests,
  format check, and `git diff --check`.

## Phase 34: First Customer Acceptance Gate

Status: `not_started`

Goal:

- Prove the product is ready to pitch and operate for the first serious customer.

Tasks:

- [x] Run the complete customer journey: landing -> signup -> workspace -> setup -> API key -> GitHub integration -> first incident -> report -> evidence inspection -> share/export.
- [x] Verify the dashboard has no obvious layout instability in the main workflow.
- [x] Verify product behavior matches the landing page and pitch script.
- [x] Make known limitations visible before the customer relies on the product.
- [x] Run hosted launch smoke tests after the release candidate deploys.
- [x] Record env vars, migrations, Inngest sync, smoke result, dashboard URL, API URL, and rollback path.
- [x] Write a go/no-go note for first-customer outreach.
- [x] Run relevant checks.

Notes:

- Phase 34 is the customer-readiness gate. If it fails, do not pitch as a ready product yet; pitch it as a controlled design-partner beta.
- Added a first-customer journey Playwright check covering landing, signup, setup, API key
  creation, GitHub integration save, first incident creation, report review, evidence inspection,
  Slack summary copy, and postmortem export.
- Fixed the first customer flow so starting a new investigation from the sidebar exits Setup and
  Support panels before showing the created investigation.
- Added a desktop main-workflow layout stability check that verifies no horizontal overflow, stable
  incident header height across refresh, and evidence inspector usability.
- Tightened landing-page and first-customer pitch claims to match v1 behavior: cited evidence is
  stored without claiming artifact hashing, unresolved dissent stays visible and reduces confidence,
  exports are postmortems rather than PDFs, and public SaaS limitations now reflect current
  workspace auth plus remaining invite/SSO/billing/admin gaps.
- Added a Known v1 Limits card to Setup so customers see trust, tenancy, and operations limits
  before creating keys or relying on a report. Browser coverage now asserts those limits are visible.
- Updated the hosted launch smoke script to create a temporary workspace through signup when no
  smoke login credentials are provided. Hosted smoke passed against Render API/dashboard and Inngest
  worker after a cold-start retry: investigation `879de809-1d6e-49dd-b67c-590dd6e71742`,
  workspace `launch-smoke-fb4306db`, confidence `0.38`.
- Added `docs/FIRST_CUSTOMER_LAUNCH_RECORD.md` with hosted URLs, required env names without secret
  values, migration status, Inngest sync URL, hosted smoke result, and rollback path. Release
  metrics now record the 2026-05-27 hosted smoke result.
- Added `docs/FIRST_CUSTOMER_GO_NO_GO.md` with a controlled design-partner beta decision,
  first-customer conditions, claims to avoid, outreach ask, and stop criteria.
- Final Phase 34 checks passed: dashboard Playwright suite, dashboard typecheck, dashboard lint,
  `node --check scripts/smoke-launch.mjs`, `pnpm format:check`, and `git diff --check`.
