# Deployment

Argus v1 deploys as three services:

- API server
- Worker/Inngest function server
- Dashboard

## Production Environment Checklist

Required:

```text
NODE_ENV=production
LOG_LEVEL=info

API_HOST=0.0.0.0
API_PORT=3001
API_KEY=local_or_break_glass_dev_key
API_RATE_LIMIT_MAX=60
API_RATE_LIMIT_WINDOW_MS=60000
API_REQUEST_BODY_LIMIT_BYTES=65536
API_CORS_ORIGIN=

AUTH_BOOTSTRAP_EMAIL=
AUTH_BOOTSTRAP_PASSWORD=
AUTH_BOOTSTRAP_WORKSPACE_NAME=
INTEGRATION_SECRET_KEY=

WORKER_HOST=0.0.0.0
WORKER_PORT=3002

NEXT_PUBLIC_API_URL=
DATABASE_URL=

INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
INNGEST_BASE_URL=

ANTHROPIC_API_KEY=

OTEL_SERVICE_NAME=argus
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
```

Optional legacy/global integration fallbacks for local or single-tenant operation. Authenticated
launch workspaces should configure integrations from the dashboard Setup panel instead:

```text
TEMPO_ENDPOINT=
LOKI_ENDPOINT=
PROMETHEUS_ENDPOINT=
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
LAUNCHDARKLY_API_TOKEN=
```

Optional model aliases:

```text
MODEL_DIRECTOR_PRIMARY=
MODEL_EXPERT_CHEAP=
MODEL_CRITIC_BALANCED=
MODEL_COUNSEL_BALANCED=
MODEL_REPORTER_PRIMARY=
```

## Build

```bash
pnpm install --frozen-lockfile
pnpm build
```

## Migrate

Run migrations against the target production database before starting new app instances:

```bash
DATABASE_URL=postgres://... pnpm db:migrate
```

## Start Services

API:

```bash
pnpm --filter @argus/api start
```

Worker:

```bash
pnpm --filter @argus/worker start
```

Dashboard:

```bash
pnpm --filter @argus/dashboard start
```

## Docker

Build individual images:

```bash
docker build -f apps/api/Dockerfile -t argus-api .
docker build -f apps/worker/Dockerfile -t argus-worker .
docker build -f apps/dashboard/Dockerfile --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" -t argus-dashboard .
```

Run the production compose stack locally against the `.env` file:

```bash
docker compose -f infra/docker-compose.prod.yml up --build
```

The compose file expects `DATABASE_URL` to point to a reachable Postgres database. It does not start a production database.

## Health Checks

```bash
curl "$API_URL/health"
curl "$DASHBOARD_URL/api/health"
curl "$WORKER_URL/health"
```

## v1 Smoke Test

For authenticated launch deployments, create a workspace API key from the dashboard Setup panel and
use that value as `API_KEY` for the smoke script. The deployment-level `API_KEY` is not the
customer integration key in production.

The smoke test validates:

```text
API health
-> create investigation
-> wait for final report
-> optional dashboard health
```

Run:

```bash
API_BASE_URL=https://api.example.com \
DASHBOARD_URL=https://dashboard.example.com \
API_KEY=workspace_api_key_from_setup \
pnpm smoke:v1
```

The worker must be reachable by Inngest at its deployed function URL, and the API must point at the same database as the worker.

## Authenticated Workspace Operations

After deploying migrations and services:

1. Log in with `AUTH_BOOTSTRAP_EMAIL` and `AUTH_BOOTSTRAP_PASSWORD`.
2. Open the dashboard Setup panel.
3. Create a workspace API key.
4. Put that key into alerting systems or scripts that call `POST /investigations`.
5. Rotate or revoke workspace API keys from the same Setup panel.

## Private Beta Operations

Before giving a company access, follow `docs/PRIVATE_BETA_RUNBOOK.md`.

The important v1 constraint is single-tenancy: one company should use one isolated API, worker,
dashboard, and database instance. Do not put multiple unrelated customers on one dashboard until auth
and tenant isolation are implemented.

For a repeatable one-company deployment, use `docs/SINGLE_TENANT_DEPLOYMENT.md` and copy
`infra/render.single-tenant.example.yaml`.

## Deployment Inputs Still Needed

To deploy beyond local Docker, choose/provide:

- Hosted Postgres URL.
- Hosting platform for API, worker, and dashboard.
- Public API URL for `NEXT_PUBLIC_API_URL`.
- Worker public URL registered with Inngest.
- Secret manager or platform env variables.
