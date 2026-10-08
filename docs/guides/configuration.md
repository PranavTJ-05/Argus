# Configuration

Copy `.env.example` to `.env` for local work. In production, set these through your host or secret manager and never commit them.

## Required in production

| Group | Variables |
| --- | --- |
| Runtime | `NODE_ENV=production`, `LOG_LEVEL` |
| API | `API_HOST`, `API_PORT`, `API_CORS_ORIGIN`, `API_RATE_LIMIT_MAX`, `API_RATE_LIMIT_WINDOW_MS`, `API_REQUEST_BODY_LIMIT_BYTES` |
| Auth | `AUTH_BOOTSTRAP_EMAIL`, `AUTH_BOOTSTRAP_PASSWORD`, `AUTH_BOOTSTRAP_WORKSPACE_NAME`, `AUTH_SESSION_SECRET` |
| Secrets | `INTEGRATION_SECRET_KEY` (same value on API and worker), `ANTHROPIC_API_KEY` (worker) |
| Data | `DATABASE_URL` |
| Workflow | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `INNGEST_BASE_URL` |
| Worker | `WORKER_HOST`, `WORKER_PORT` |
| Dashboard | `NEXT_PUBLIC_API_URL` |
| Telemetry | `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_{TRACES,METRICS,LOGS}_EXPORTER` |

`INTEGRATION_SECRET_KEY` encrypts workspace integration tokens. If the API and worker hold different values, stored credentials cannot be decrypted.

## Optional

- **Model aliases:** `MODEL_DIRECTOR_PRIMARY`, `MODEL_EXPERT_CHEAP`, `MODEL_CRITIC_BALANCED`, `MODEL_COUNSEL_BALANCED`, `MODEL_REPORTER_PRIMARY`. Defaults exist; set them only to switch models.
- **Global evidence fallbacks** (local or single-tenant use): `TEMPO_ENDPOINT`, `LOKI_ENDPOINT`, `PROMETHEUS_ENDPOINT`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `LAUNCHDARKLY_API_TOKEN`. Hosted workspaces configure these in the dashboard Setup panel instead.
- **`API_KEY`:** a local-development fallback only. Production customers use workspace API keys.

## Fail-fast behavior

Live phases stop with a clear error when a required credential is missing, and config is validated with Zod at startup.

## Credentials by capability

| Capability | Needs |
| --- | --- |
| Live agents | `ANTHROPIC_API_KEY` |
| Evidence from GitHub | Read access to repository contents, plus Actions metadata for deploy evidence |
| Evidence from Tempo, Loki, Prometheus | Reachable endpoint URLs, configured per workspace |
| Hosted workflow | Inngest keys and a worker URL registered with Inngest |
| Browser access to a separate dashboard origin | `API_CORS_ORIGIN` |
