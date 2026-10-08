# Single-Tenant Company Deployment

Use this guide when deploying Argus for one company or one internal team.

Argus v1 is not multi-tenant SaaS. Do not put multiple unrelated customers on one shared
dashboard, API, worker, or database until Phase 22 and Phase 23 are complete.

## Model

One company gets one isolated stack:

```text
argus-api-<company-slug>
argus-worker-<company-slug>
argus-dashboard-<company-slug>
argus-db-<company-slug>
```

All three services must point to the same company-specific Postgres database.

Example for Acme:

```text
argus-api-acme
argus-worker-acme
argus-dashboard-acme
argus-db-acme
```

## Render Blueprint

Use `infra/render.single-tenant.example.yaml` as the customer-specific starting point.

Before importing it into Render:

1. Replace every `<company-slug>` placeholder.
2. Replace public URLs with the final Render service URLs if you already know them.
3. Keep `API_KEY` as a manually supplied secret on API and dashboard. It must be the same value.
4. Keep customer secrets as `sync: false`; never commit real values.
5. After the first deploy, verify `API_CORS_ORIGIN` points to the customer dashboard URL.

The root `render.yaml` is for the current Argus deployment. The single-tenant example is the
template to copy for future one-company deployments.

## Environment Ownership

### Operator-Owned Values

These are owned by whoever operates the Argus deployment:

```text
NODE_ENV
LOG_LEVEL
API_HOST
API_PORT
API_CORS_ORIGIN
API_RATE_LIMIT_MAX
API_RATE_LIMIT_WINDOW_MS
API_REQUEST_BODY_LIMIT_BYTES
WORKER_HOST
WORKER_PORT
NEXT_PUBLIC_API_URL
DATABASE_URL
INNGEST_BASE_URL
OTEL_SERVICE_NAME
OTEL_EXPORTER_OTLP_ENDPOINT
OTEL_TRACES_EXPORTER
OTEL_METRICS_EXPORTER
OTEL_LOGS_EXPORTER
ANTHROPIC_API_KEY
AUTH_BOOTSTRAP_EMAIL
AUTH_BOOTSTRAP_PASSWORD
AUTH_BOOTSTRAP_WORKSPACE_NAME
```

### Customer-Provided Values

These come from the company using Argus when they want stronger evidence:

```text
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
TEMPO_ENDPOINT
LOKI_ENDPOINT
PROMETHEUS_ENDPOINT
LAUNCHDARKLY_API_TOKEN
```

For v1, start with one integration. GitHub is usually the easiest first source because it provides
code and deploy context without requiring a full observability rollout.

### Generated Values

Generate these per company deployment:

```text
API_KEY
Postgres password
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
```

The same `API_KEY` must be configured on:

- `argus-api-<company-slug>`
- `argus-dashboard-<company-slug>`

Do not expose this key in browser code. Dashboard creates investigations through its server route,
which reads `API_KEY` from the dashboard service environment.

## New Customer Deployment Steps

1. Choose a company slug.

   Use a short lowercase slug, for example `acme`, `internal-sre`, or `checkout-team`.

2. Create or import the Render services.

   Use `infra/render.single-tenant.example.yaml` or manually create:

   ```text
   argus-api-<company-slug>
   argus-worker-<company-slug>
   argus-dashboard-<company-slug>
   argus-db-<company-slug>
   ```

3. Set service environment variables.

   Confirm:

   - API and worker share the same `DATABASE_URL`.
   - API and dashboard share the same `API_KEY`.
   - API has `AUTH_BOOTSTRAP_EMAIL` and `AUTH_BOOTSTRAP_PASSWORD` set.
   - dashboard `NEXT_PUBLIC_API_URL` points to the customer API URL.
   - API `API_CORS_ORIGIN` points to the customer dashboard URL.
   - worker `INNGEST_SIGNING_KEY` matches the signing key shown in Inngest for this app.

4. Run database migrations against the customer database.

   From local terminal or a secure CI job:

   ```bash
   DATABASE_URL="postgres://..." pnpm db:migrate
   ```

   Use the external Postgres URL with SSL when running from outside Render.

5. Deploy API, worker, and dashboard.

6. Sync the worker with Inngest.

   In Inngest Production, sync the app URL:

   ```text
   https://argus-worker-<company-slug>.onrender.com/api/inngest
   ```

   Confirm Inngest shows the `argus` app and the `Investigation Requested` function.

7. Run health checks.

   ```bash
   curl "https://argus-api-<company-slug>.onrender.com/health"
   curl "https://argus-worker-<company-slug>.onrender.com/health"
   curl "https://argus-dashboard-<company-slug>.onrender.com/api/health"
   ```

8. Run the deployed smoke test.

   ```bash
   API_BASE_URL="https://argus-api-<company-slug>.onrender.com" \
   DASHBOARD_URL="https://argus-dashboard-<company-slug>.onrender.com" \
   API_KEY="..." \
   pnpm smoke:v1
   ```

9. Run the demo seed if this is a customer walkthrough environment.

   ```bash
   API_BASE_URL="https://argus-api-<company-slug>.onrender.com" \
   DASHBOARD_URL="https://argus-dashboard-<company-slug>.onrender.com" \
   API_KEY="..." \
   pnpm demo:v1
   ```

10. Open the dashboard and confirm the investigation appears.

## Customer Handoff

Give the customer only what they need:

```text
Dashboard URL:
API URL:
API key:
Worker/Inngest URL, if they need to inspect workflow sync:
Current enabled integrations:
Known limitations:
```

Handoff checklist:

- [ ] Show them how to open the dashboard.
- [ ] Show them how to create an investigation from the dashboard.
- [ ] Give the server-side API example from `docs/INTEGRATION_GUIDE.md`.
- [ ] Ask for one service and one recurring incident type.
- [ ] Configure one evidence integration, preferably GitHub first.
- [ ] Explain that missing integrations become setup gaps and reduce confidence.
- [ ] Explain that low confidence is expected when evidence is weak.
- [ ] Agree how API key rotation will happen.

## Stop Conditions

Do not onboard another unrelated customer into the same stack.

Create a new isolated stack for each new company until:

- dashboard login exists,
- read APIs are authenticated,
- investigations and artifacts are workspace-scoped,
- integration credentials are stored per workspace,
- tenant isolation tests pass.
