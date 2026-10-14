# Gap Analysis

Review of the full stack against production readiness. Items marked **fixed** were addressed in the repo; the rest are proposals.

## Fixed

- `render.yaml`: `INTEGRATION_SECRET_KEY` was listed twice on the API service and missing on the worker. The config default is a dev key, so the worker would silently use a different key than the API and fail to decrypt workspace integration credentials. The worker now declares it.
- README claimed "Planning and scaffolding stage"; updated to the real status.
- Added `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `.nvmrc`, Dependabot, and a CI workflow (`pnpm check`, format check, smoke eval).

## Open gaps

| Area | Gap | Suggested layer |
| --- | --- | --- |
| Secrets | `INTEGRATION_SECRET_KEY` has an insecure default; production should refuse to boot with it. | Fail-fast check in `@argus/config` when `NODE_ENV=production` |
| Rate limiting | In-memory buckets in `apps/api/src/security.ts` do not work across more than one API instance. | Redis or Postgres-backed limiter |
| Migrations | Run manually (`pnpm db:migrate`); no release step in Dockerfiles or Render. | Render pre-deploy command or a one-shot migrate job |
| Config | `API_KEY` is `generateValue` on both API and worker, producing two different keys; `OTEL_*_EXPORTER=otlp` is set without `OTEL_EXPORTER_OTLP_ENDPOINT`. | Drop the worker key; set the endpoint or use `none` |
| Docs | AGENTS.md lists shadcn/ui but the dashboard does not use it. | Adopt it or correct AGENTS.md |
| Observability | No error tracking, uptime alerts or SLOs; dashboards for the worker queue depth are missing. | Sentry, Grafana alerts |
| Reliability | Free Render tier sleeps and free Postgres expires; no backup or restore drill. | Paid tier, PITR backups, documented restore |
| Environments | Single environment, no staging or preview deploys. | Staging service with seeded demo data |
| Cost control | No per-workspace LLM token budget or spend cap. | Usage metering in `llm-gateway` |
| Security | No audit log for API key creation, rotation and revocation; no dependency or container scanning. | Audit table, `pnpm audit`, Trivy in CI |
| Product | No Slack or PagerDuty intake or notification; no Datadog, Sentry or Honeycomb backends. | New adapters in `@argus/backends` |
| Testing | Playwright and live-loop paths are not exercised in CI. | Add an e2e job with Postgres service |
