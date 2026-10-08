# Deployment

Argus ships as three services: **API**, **worker** (Inngest function server) and **dashboard**, all backed by one Postgres database. Variables are listed in [../guides/configuration.md](../guides/configuration.md).

## Build and migrate

```bash
pnpm install --frozen-lockfile
pnpm build
DATABASE_URL=postgres://... pnpm db:migrate   # before starting new instances
```

Migrations are manual today. Run them before every production deploy and avoid destructive schema changes.

## Start commands

```bash
pnpm --filter @argus/api start
pnpm --filter @argus/worker start
pnpm --filter @argus/dashboard start
```

## Docker

```bash
docker build -f apps/api/Dockerfile -t argus-api .
docker build -f apps/worker/Dockerfile -t argus-worker .
docker build -f apps/dashboard/Dockerfile --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" -t argus-dashboard .
docker compose -f infra/docker-compose.prod.yml up --build
```

The production compose file expects `DATABASE_URL` to point at an existing Postgres; it does not start one.

## Render

`render.yaml` defines the three services with health checks. Create services with the names it declares, or update the URLs it contains (`NEXT_PUBLIC_API_URL`, `API_CORS_ORIGIN`) to match yours. After deploying the worker, sync Inngest to `https://<worker-host>/api/inngest` and confirm the `argus` app and its `Investigation Requested` function appear. Re-sync whenever the worker URL, signing key or function set changes.

## Health checks

```bash
curl "$API_URL/health"
curl "$WORKER_URL/health"
curl "$DASHBOARD_URL/api/health"
```

## Smoke tests

```bash
API_BASE_URL=... DASHBOARD_URL=... API_KEY=<workspace key> pnpm smoke:v1      # create investigation, wait for report
API_BASE_URL=... DASHBOARD_URL=... pnpm smoke:launch                          # signup to report
```

`smoke:launch` signs up a temporary workspace unless `ARGUS_LOGIN_EMAIL` and `ARGUS_LOGIN_PASSWORD` are set. Hosted cold starts can be slow, so raise `SMOKE_TIMEOUT_MS` if the first attempt times out.

## Single-tenant company deployment

Argus v1 should not host unrelated customers in one stack. Give each company its own isolated set:

```text
argus-api-<slug>   argus-worker-<slug>   argus-dashboard-<slug>   argus-db-<slug>
```

Start from `infra/render.single-tenant.example.yaml` and replace every `<company-slug>`.

| Owner | Values |
| --- | --- |
| Operator | Runtime, URLs, `DATABASE_URL`, Inngest base URL, OTel, `ANTHROPIC_API_KEY`, bootstrap auth |
| Customer | `GITHUB_*`, `TEMPO_ENDPOINT`, `LOKI_ENDPOINT`, `PROMETHEUS_ENDPOINT`, flag token |
| Generated per company | `API_KEY`, Postgres password, Inngest event and signing keys |

Steps:

1. Pick a short lowercase slug.
2. Create or import the services; API and worker share one `DATABASE_URL`; API and dashboard share the same `API_KEY`.
3. Run migrations against the company database (external URL with SSL when outside Render).
4. Deploy, sync Inngest, run health checks, run `pnpm smoke:v1`.
5. For walkthrough environments, run `pnpm demo:v1`.
6. Hand over dashboard URL, API URL and key, enabled integrations and known limitations.

Do not add a second customer to an existing stack.

## After deploying

Log in with the bootstrap account, open Setup, create a workspace API key, and use that key in alerting or scripts. Rotate and revoke keys from the same panel.
