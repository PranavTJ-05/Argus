# Security Review

This review records the v1 release-gate security posture for Argus.

## Scope

Reviewed areas:

- Secrets and runtime configuration.
- External API authentication.
- API rate limiting and request size limits.
- CORS/browser access posture.
- Request, response, event, and LLM-output validation.

## Result

Status: pass for authenticated workspace launch.

Argus is acceptable for a controlled launch deployment with dashboard login and workspace API
keys. Broader multi-customer scale still requires a shared rate-limit backend and production account
lifecycle flows.

## Findings

### Secrets

- Real secrets are expected only in environment variables or deployment secret storage.
- `.env.example` contains placeholders and development defaults only.
- Config loading uses Zod validation in `packages/config/src/index.ts`.
- Production requires real `ANTHROPIC_API_KEY`, `DATABASE_URL`, `INNGEST_EVENT_KEY`,
  `INNGEST_SIGNING_KEY`, and bootstrap auth credentials.
- The deployment `API_KEY` is retained only as a local-development fallback; customer integration
  keys are generated per workspace and stored hashed.

Decision: pass.

### Authentication

- Dashboard access requires an API-backed session.
- Workspace API keys are hashed before persistence and raw keys are shown only once.
- Workspace integration secrets are encrypted before persistence and metadata responses do not
  include raw tokens.
- `POST /investigations` scopes created investigations to the workspace that owns the session or
  API key.
- Investigation reads, artifact reads, report reads, tool-call reads, and SSE streams are
  workspace-scoped.
- Production API construction fails closed if the auth repository is not configured.

Decision: pass.

Required before public multi-tenant release:

- Add production-grade signup/invite/reset flows.
- Move rate limiting to a shared backend.

### Rate Limiting And Request Size

- `POST /investigations` is rate-limited per client IP/route for local fallback mode.
- Authenticated investigation creation is also rate-limited by workspace/API-key identity.
- Rate-limit responses include `Retry-After` and `X-RateLimit-*` headers.
- Fastify request body size is bounded by `API_REQUEST_BODY_LIMIT_BYTES`.
- Auth, rate-limit, and payload-too-large behavior is covered by API tests.

Decision: pass for v1.

Required before horizontally scaled production:

- Move rate-limit state from in-memory buckets to Redis or another shared store.

### CORS

- The API uses an explicit CORS allowlist through `API_CORS_ORIGIN`.
- Browser clients on another origin should not directly call the API unless their origin is
  configured on the API service.
- API tests verify untrusted origins do not receive `Access-Control-Allow-Origin`.

Decision: pass for same-origin dashboard and server-to-server integrators.

Required before browser-based third-party integrations:

- Add per-tenant or per-application CORS allowlists.

### Validation

- API route params, queries, request bodies, and response payloads are validated with Zod.
- Worker Inngest events are validated with Zod while allowing Inngest production metadata.
- LLM outputs are strict JSON and validated before persistence.
- Strict JSON repair is attempted once; if repair still fails, the workflow records a conservative
  fallback output instead of persisting unvalidated model text.

Decision: pass.

### Secret Exposure

- Dashboard API proxy routes keep session tokens in http-only cookies and forward them server-side.
- Workspace API keys are raw only at creation/rotation time and are never listed afterward.
- Integration tokens are encrypted in the database and represented in dashboard responses only by
  boolean presence and optional key hint metadata.
- Client-facing docs and examples use placeholders. Real operator secrets remain in deployment
  secret storage.

Decision: pass.

### Migrations

- Database migrations are append-only SQL files under `packages/db/migrations`.
- Phase 26 migration adds `workspace_status` and a non-null `workspaces.status` column with default
  `active`, so existing workspaces remain usable after deploy.
- Rollback posture for v1 is restore from managed Postgres backup before the migration, then redeploy
  the previous commit. Do not drop the enum or column while new code may still reference it.

Decision: pass for launch.

### Workflow Reliability

- Worker tests cover idempotent no-ops for completed and failed investigation retries.
- Worker tests cover cancellation before agent execution and already-cancelled investigations.
- Strict LLM validation failures fall back to conservative structured output rather than storing raw
  invalid text.
- `scripts/smoke-launch.mjs` covers login, workspace API key creation, investigation creation, report
  polling, and dashboard health for launch verification.

Decision: pass.

## Release Constraint

v1 may be released as an authenticated workspace launch candidate. A broader public launch requires
production account lifecycle and shared rate-limit storage.

See `docs/V1_LIMITATIONS.md` for the complete v1 limitation list and
`docs/PRIVATE_BETA_RUNBOOK.md` for single-tenant beta operations.
