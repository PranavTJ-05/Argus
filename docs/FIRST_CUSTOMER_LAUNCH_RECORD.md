# First Customer Launch Record

Last updated: 2026-05-27T08:49:12Z

This record captures the hosted Argus launch candidate state without exposing secret values.

## Hosted URLs

```text
Dashboard URL: https://argus-dashboard.onrender.com
API URL: https://argus-api.onrender.com
Worker URL: https://argus-worker.onrender.com
Inngest sync URL: https://argus-worker.onrender.com/api/inngest
```

## Code And Deployment Baseline

```text
Last committed baseline: 678abff Add operator support console reliability
Latest migration file: packages/db/migrations/0006_next_invisible_woman.sql
```

Phase 34 has local customer-readiness edits that are not part of the committed baseline until the
next commit/deploy. No Phase 34 change adds a database migration.

## Required Hosted Environment

Required operator-owned values:

```text
NODE_ENV=production
LOG_LEVEL=info
API_HOST=0.0.0.0
API_PORT=3001
API_KEY=<break-glass/local fallback only>
API_RATE_LIMIT_MAX=<set>
API_RATE_LIMIT_WINDOW_MS=<set>
API_REQUEST_BODY_LIMIT_BYTES=<set>
API_CORS_ORIGIN=https://argus-dashboard.onrender.com
AUTH_BOOTSTRAP_EMAIL=<set>
AUTH_BOOTSTRAP_PASSWORD=<set>
AUTH_BOOTSTRAP_WORKSPACE_NAME=<set>
AUTH_SESSION_SECRET=<set>
INTEGRATION_SECRET_KEY=<set on API and worker>
WORKER_HOST=0.0.0.0
WORKER_PORT=3002
NEXT_PUBLIC_API_URL=https://argus-api.onrender.com
DATABASE_URL=<Render Postgres URL>
INNGEST_EVENT_KEY=<set>
INNGEST_SIGNING_KEY=<set on API and worker>
INNGEST_BASE_URL=https://api.inngest.com
ANTHROPIC_API_KEY=<set on worker>
OTEL_SERVICE_NAME=argus
```

Optional per-workspace customer evidence integrations are configured in dashboard Setup, not as
shared global env for public launch workspaces:

```text
GitHub owner, repo, and read token
Prometheus endpoint
Loki endpoint
Tempo endpoint
```

## Migration Status

Production migrations must be run before a release candidate deploy:

```bash
DATABASE_URL=<production-postgres-url> pnpm db:migrate
```

Current Phase 34 readiness changes do not add migrations. The hosted smoke test proves the deployed
API and worker can read/write the current production schema, but the migration command should still
be re-run before the next release candidate deploy.

## Inngest Status

Inngest Production must be synced to:

```text
https://argus-worker.onrender.com/api/inngest
```

The hosted smoke test completed through the worker, which confirms Inngest can reach the deployed
function endpoint. Re-sync Inngest after worker URL, signing key, or function registration changes.

## Hosted Smoke Result

Command:

```bash
API_BASE_URL=https://argus-api.onrender.com \
DASHBOARD_URL=https://argus-dashboard.onrender.com \
SMOKE_TIMEOUT_MS=600000 \
pnpm smoke:launch
```

Result:

```json
{
  "authMode": "signup",
  "ok": true,
  "confidence": 0.38,
  "investigationId": "879de809-1d6e-49dd-b67c-590dd6e71742",
  "workspace": "launch-smoke-fb4306db"
}
```

Note: the first smoke attempt created investigation `235c581b-ed4c-4670-bae2-cbd0c3a82b93` but
timed out waiting for a report. The retry passed with a longer timeout, consistent with hosted
cold-start or workflow dispatch latency.

## Rollback Path

1. Redeploy the previous known-good commit from Render or GitHub.
2. Do not run destructive migrations during rollback.
3. If a migration caused data issues, restore the managed Postgres backup from before that migration.
4. Re-sync Inngest only if the worker URL or function registration changed.
5. Run API, dashboard, and worker health checks.
6. Run `pnpm smoke:launch` against the rolled-back deployment.
7. If customer write traffic is unsafe, suspend the affected workspace or revoke workspace API keys
   while preserving dashboard read access where possible.

