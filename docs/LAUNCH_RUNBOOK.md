# Public Launch Runbook

This runbook is for operating the hosted Argus launch deployment.

## Release Gate

Before tagging or announcing a launch candidate:

```bash
pnpm --filter @argus/api test
pnpm --filter @argus/db test
pnpm --filter @argus/dashboard test
pnpm --filter @argus/api typecheck
pnpm --filter @argus/db typecheck
pnpm --filter @argus/dashboard typecheck
pnpm eval:full
pnpm smoke:launch
pnpm format:check
git diff --check
```

`pnpm smoke:launch` requires `API_BASE_URL` and can optionally take `DASHBOARD_URL`. If
`ARGUS_LOGIN_EMAIL` and `ARGUS_LOGIN_PASSWORD` are set, it logs in to that workspace. If
they are not set, it creates a temporary smoke workspace through the hosted signup flow.

Record eval results in `docs/RELEASE_METRICS.md`.

Create the launch tag only after the release commit is on the release branch:

```bash
git tag -a v1.0.0-launch -m "Argus v1 public launch"
git push origin v1.0.0-launch
```

## Support Intake

Use `docs/SUPPORT_RUNBOOK.md` for the detailed operator workflow. This section is the short intake
checklist for launch incidents.

When a customer reports a problem, collect:

- workspace name or slug;
- dashboard URL and approximate time;
- investigation ID or incident ID;
- whether the issue is signup/login, API key, integration setup, workflow failure, dashboard display,
  or report quality;
- relevant HTTP status code or dashboard screenshot with secrets hidden.

Do not ask customers to paste raw API keys, Anthropic keys, GitHub tokens, or observability tokens.

## First Response Checklist

1. Check API, dashboard, worker, Postgres, and Inngest health.
2. Check whether the customer's workspace is active, suspended, or disabled.
3. Check whether the workspace API key is active.
4. Check investigation events and terminal status.
5. Check evidence gaps before treating a low-confidence report as a model failure.
6. Check worker logs for provider, database, and integration errors.

## Incident Response

For platform incidents:

1. Stop new customer-triggered work by suspending affected workspaces or revoking affected API keys.
2. Keep read access available when possible so customers can see historical reports.
3. Inspect Inngest failed runs and worker logs.
4. If a bad deploy caused the issue, roll back to the last known-good commit.
5. Run smoke checks before re-enabling write traffic.
6. Write a short post-incident note with cause, customer impact, and prevention.

## Rollback

Rollback code:

1. Redeploy the previous known-good commit.
2. Do not run destructive migrations during rollback.
3. Run API, dashboard, and worker health checks.
4. Run `pnpm smoke:launch`.
5. Monitor failed investigations and Inngest retries.

Rollback access:

1. Revoke or rotate leaked workspace API keys.
2. Suspend a workspace if abuse or billing risk is suspected.
3. Disable an account only when support needs to stop both writes and dashboard access.

## Customer Handoff

Give each customer:

- dashboard URL;
- API base URL;
- signup or login instructions;
- workspace API key creation instructions;
- `docs/INTEGRATION_GUIDE.md`;
- explanation of citations, confidence, dissent, and setup gaps from `docs/PRODUCT_CONCEPTS.md`;
- list of integrations they should configure first.

Recommended first integration order:

1. GitHub for code and deploy context.
2. Prometheus for metric evidence.
3. Loki for log evidence.
4. Tempo for trace evidence.

The product is usable with only API-triggered incidents, but report quality improves as evidence
integrations are connected.
