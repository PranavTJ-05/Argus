# Limitations and Roadmap

Argus v1 proves the citation-backed multi-agent loop and ships authenticated workspaces. It is a launch candidate, not a mature public platform.

## Known limitations

| Area | Today |
| --- | --- |
| Tenancy and auth | Login, workspace-scoped reads and workspace API keys exist; no invites, SSO, password reset or automated billing |
| Rate limiting | In-memory per API instance |
| Evidence | Works only for configured sources; flag evidence is a documented v1 cut; local fallback traces are demo-grade |
| Agent reliability | Strict JSON with one repair retry, then a conservative fallback that weakens evidence value and should be monitored |
| Evaluation | Four deterministic cases; proves scoring and contracts, not coverage of all incident types |
| Operations | Free hosting can sleep; migrations and Inngest sync are manual; no automated rollback or disaster recovery |
| Dashboard | Replay is read-only; event retention policy not finalized |
| Browser access | No permissive CORS; third-party browser apps need an allowlisted origin, so integrate from servers |

## Gap analysis and proposed layers

| Area | Gap | Suggested layer |
| --- | --- | --- |
| Secrets | `INTEGRATION_SECRET_KEY` has an insecure default | Fail fast in `@argus/config` when `NODE_ENV=production` |
| Rate limiting | Not shared across instances | Redis or Postgres-backed limiter |
| Migrations | Run by hand | Render pre-deploy command or one-shot job |
| Render config | Separate generated `API_KEY` on API and worker; OTLP exporter set without an endpoint | Remove the worker key; set the endpoint or use `none` |
| Docs and tooling | AGENTS.md lists shadcn/ui but the dashboard does not use it | Adopt it or correct AGENTS.md |
| Observability | No error tracking, alerts or SLOs | Sentry, Grafana alerts, queue-depth dashboards |
| Reliability | No backup and restore drill | Point-in-time backups and a documented restore |
| Environments | One environment | Staging with seeded demo data |
| Cost control | No per-workspace spend cap | Usage metering in the gateway |
| Security | No audit log for key events; no dependency or image scanning | Audit table, `pnpm audit`, Trivy in CI |
| Product | No Slack or PagerDuty intake or notification; limited backends | New adapters (Datadog, Sentry, Honeycomb) |
| Testing | E2E and the live loop are not in CI | E2E job with a Postgres service |

## Already addressed

- `INTEGRATION_SECRET_KEY` declared once on the API and added to the worker in `render.yaml`.
- Added `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `.nvmrc`, Dependabot and a CI workflow.

## Release path

Foundations first, then in order: real LLM gateway and agents, live tool integrations, the external API, workflow hardening, deployment, and a release gate (checks, eval metrics, security review, docs, tag). Live and mocked paths coexist; production code defaults to live. Phase detail is in [../project/delivery-plan.md](../project/delivery-plan.md).
