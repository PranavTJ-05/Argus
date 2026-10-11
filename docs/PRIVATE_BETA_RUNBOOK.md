# Private Beta Runbook

Argus v1 is ready for one company or one controlled customer as a single-tenant deployment. Do
not use one shared deployment for multiple unrelated customers until auth and tenant isolation are
implemented.

## Deployment Model

Use one isolated instance per company:

```text
argus-api-<company>
argus-worker-<company>
argus-dashboard-<company>
argus-db-<company>
```

The API, worker, and dashboard must point to the same company-specific Postgres database.

Use `docs/SINGLE_TENANT_DEPLOYMENT.md` for the repeatable Render blueprint flow, environment split,
migration steps, Inngest sync, smoke test, and customer handoff checklist.

## API Key Rotation

v1 uses one shared write key per single-tenant deployment.

Rotate the key when:

- a teammate leaves the beta,
- the key appears in a screenshot, log, chat, or browser code,
- a customer asks for rotation,
- moving from demo to real incident testing.

Rotation steps:

1. Generate a new strong random value.
2. Update `API_KEY` on the API service.
3. Update `API_KEY` on the dashboard service so the server-side create form still works.
4. Update any customer scripts, alert webhooks, or runbooks.
5. Redeploy/restart API and dashboard services if the platform does not apply env changes live.
6. Run:

   ```bash
   API_BASE_URL=... DASHBOARD_URL=... API_KEY=... pnpm smoke:v1
   ```

7. Revoke or delete the old key from the deployment platform and customer docs.

Never put `API_KEY` in browser-side JavaScript. Dashboard writes must go through the dashboard
server route.

## Dashboard And Read Access Risk

In v1, read endpoints and the dashboard are not user-authenticated.

Acceptable for private beta:

- one company uses the deployment,
- dashboard URL is shared only with trusted users,
- data is not mixed with another customer,
- the deployment is treated as private infrastructure.

Not acceptable:

- multiple unrelated customers sharing one dashboard,
- public marketing demo with real incident data,
- sensitive customer incidents in an unauthenticated public dashboard.

Before public SaaS, implement auth and tenant isolation.

## Operator Monitoring

Check these before and during beta:

```bash
curl "$API_BASE_URL/health"
curl "$DASHBOARD_URL/api/health"
curl "$WORKER_URL/health"
```

Monitor:

- API 4xx/5xx rates.
- Worker failures and Inngest failed runs.
- Failed investigations in the dashboard.
- Anthropic usage and cost.
- Postgres availability and storage.
- Evidence setup gaps, especially missing GitHub, metric, log, or trace integrations.

If an investigation fails, inspect:

1. dashboard event replay,
2. Inngest run logs,
3. worker logs,
4. API logs,
5. database connectivity.

## Visible Beta Limitations

Tell beta users:

- v1 is single-tenant/private beta, not public multi-tenant SaaS.
- Dashboard login is not built yet.
- Read APIs are not tenant-scoped.
- Evidence quality depends on connected integrations.
- Missing integrations appear as setup gaps and lower confidence.
- Low confidence can be correct behavior when evidence is weak.

## Beta Onboarding Checklist

- [ ] Choose one company or internal team.
- [ ] Choose one service to investigate first.
- [ ] Choose one recurring incident pattern.
- [ ] Create isolated API, worker, dashboard, and database services.
- [ ] Set production env vars and secrets.
- [ ] Run database migrations.
- [ ] Sync the worker URL with Inngest.
- [ ] Configure first evidence source, preferably GitHub or Prometheus.
- [ ] Run `pnpm smoke:v1`.
- [ ] Run `pnpm demo:v1`.
- [ ] Give the customer dashboard URL, API URL, and API key.
- [ ] Share `docs/DEMO_PLAYBOOK.md` and `docs/INTEGRATION_GUIDE.md` as needed.
- [ ] Ask the customer to submit one real incident payload.

## Rollback Or Disable

To stop a beta quickly:

1. Rotate or remove `API_KEY`.
2. Disable customer alert webhook or script.
3. Suspend or stop the worker service to stop new workflow execution.
4. Keep the database intact for debugging unless deletion is explicitly required.
5. Notify the customer which investigations may be incomplete.

To roll back code:

1. Redeploy the previous known-good commit or image.
2. Do not run destructive migrations while rolling back.
3. Run health checks.
4. Run `pnpm smoke:v1`.
