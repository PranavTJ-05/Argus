# v1 Credentials

Argus should fail fast when a live phase needs a credential that is missing. Do not hard-code secrets and do not commit `.env`.

## Local Env Flow

If you have a local env file from another machine or password manager export, copy it to `.env`:

```bash
cp .env.local .env
```

This repository currently commits only `.env.example`. If `.env.local` does not exist, create `.env` from the example:

```bash
cp .env.example .env
```

Then replace only the values needed for the current phase.

## Phase 9: Real LLM Gateway and Agents

Required:

```text
ANTHROPIC_API_KEY=
```

Optional model alias overrides:

```text
MODEL_DIRECTOR_PRIMARY=
MODEL_EXPERT_CHEAP=
MODEL_CRITIC_BALANCED=
MODEL_COUNSEL_BALANCED=
MODEL_REPORTER_PRIMARY=
```

Purpose:

- `ANTHROPIC_API_KEY` authenticates live model calls.
- `MODEL_*` values keep application code using stable aliases instead of hard-coded model names. Local defaults are provided, so you only need to set them when changing models.

## Phase 10: Live Tool Integrations

Legacy global env values for local or single-tenant operation:

```text
TEMPO_ENDPOINT=
LOKI_ENDPOINT=
PROMETHEUS_ENDPOINT=
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
LAUNCHDARKLY_API_TOKEN=
```

Purpose:

- Tempo supplies traces.
- Loki supplies logs.
- Prometheus supplies metrics.
- GitHub supplies deploy context through GitHub Actions and code context through repository code
  search.
- LaunchDarkly is documented as a v1 cut in the current implementation; missing flag evidence is recorded as skipped evidence instead of being mocked as real data.

For authenticated launch workspaces, these values are configured from the dashboard Setup panel and
stored per workspace. Set `INTEGRATION_SECRET_KEY` on API and worker to the same strong secret so
stored integration tokens can be encrypted and decrypted.

Recommended first customer integration:

```text
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
```

For a fine-grained GitHub token, grant read-only repository contents access for code search and
Actions metadata access if deploy evidence should use workflow runs.

## Phase 11: External Integration API

Required:

```text
API_CORS_ORIGIN=
```

Purpose:

- `API_KEY` remains available only as a local-development fallback.
- Production customer integrations use workspace API keys generated from the dashboard Setup panel.
- External clients pass workspace keys as `Authorization: Bearer <WORKSPACE_API_KEY>` or
  `X-API-Key: <WORKSPACE_API_KEY>`.
- `API_CORS_ORIGIN` allows the hosted dashboard origin to read the API from the browser.

## Phase 12: Production Workflow Hardening

Required for hosted workflow and telemetry:

```text
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
INNGEST_BASE_URL=
OTEL_EXPORTER_OTLP_ENDPOINT=
```

Purpose:

- Inngest keys authenticate workflow events and callbacks.
- OTLP endpoint sends traces, metrics, and logs to the selected observability backend.

## Phase 13: Deployment

Required from the deployment platform:

```text
DATABASE_URL=
NEXT_PUBLIC_API_URL=
API_HOST=
API_PORT=
```

Plus all live credentials required by Phases 9-12.

Production secrets should live in the deployment platform or secret manager, not in Git.

## Phase 28: Public Launch Signup

Required for the operator-owned hosted deployment:

```text
AUTH_SESSION_SECRET=
INTEGRATION_SECRET_KEY=
ANTHROPIC_API_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
DATABASE_URL=
NEXT_PUBLIC_API_URL=
API_CORS_ORIGIN=
```

Purpose:

- New users create their own dashboard login and workspace through `/signup`.
- Workspace API keys are generated inside the dashboard Setup panel.
- Customer evidence credentials are configured per workspace inside Setup, not shared from one
  global `.env` across unrelated customers.
- `AUTH_BOOTSTRAP_EMAIL` and `AUTH_BOOTSTRAP_PASSWORD` can remain for operator recovery, but normal
  customers should use the self-serve signup flow.
