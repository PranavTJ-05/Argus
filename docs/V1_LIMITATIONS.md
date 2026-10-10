# v1 Known Limitations

Argus v1 proves the citation-backed multi-agent investigation loop and now has authenticated
workspace access. It is still a launch candidate, not a mature public incident platform.

For safe beta operation, use `docs/PRIVATE_BETA_RUNBOOK.md`.

## Security And Tenancy

- Dashboard access requires a login session.
- Investigation reads are workspace-scoped.
- Customer integrations should use workspace API keys generated from the dashboard Setup panel.
- The deployment-level `API_KEY` is retained only as a local-development fallback.
- Rate limiting is in-memory per API instance.

Before public multi-tenant release:

- Add production signup/invite flows beyond the bootstrap admin user.
- Add per-workspace integration credential storage.
- Move rate limiting to a shared store such as Redis.

## Live Evidence Coverage

- Tempo, Loki, Prometheus, GitHub, and flag evidence work only when their credentials/endpoints are
  configured.
- GitHub code evidence uses repository code search when GitHub credentials are configured for the
  investigation workspace.
- Prometheus, Loki, and Tempo evidence use the endpoint configured for the investigation workspace.
- Missing integrations are recorded as evidence gaps or skipped evidence.
- LaunchDarkly/feature-flag evidence is a documented v1 cut until a concrete flag backend contract
  is added.
- Local fallback trace evidence can keep demos moving, but production-grade conclusions require
  real observability backends.

## Agent Reliability

- LLM outputs are validated with strict Zod schemas.
- Failed strict JSON output gets one repair retry.
- If repair also fails, v1 records a conservative fallback output rather than persisting malformed
  model text.
- Fallback output prevents workflow failure, but it reduces evidence value and should be monitored
  before wider release.

## Evaluation Coverage

- The full v1 eval dataset is deterministic and currently has 4 cases.
- The eval validates scoring, citation contracts, dissent handling, and release threshold math.
- It does not prove performance across all production incident types.
- Real-world release confidence should grow with a larger incident dataset.

## Deployment And Operations

- The current hosted deployment runs on free Render services, which can sleep or cold start.
- Inngest must be synced to the deployed worker URL after worker endpoint changes.
- Database migrations are manual before deploy.
- Rollback and disaster recovery procedures are not automated.

## Dashboard And Replay

- Replay is read-only in v1.
- Branching replay is intentionally not implemented.
- Dashboard auth uses an HTTP-only session cookie backed by API sessions.
- SSE live view supports reconnect by event sequence, but long-term event retention policy is not
  finalized.

## Browser Integrations

- The API does not enable permissive CORS.
- The hosted dashboard origin must be configured with `API_CORS_ORIGIN`.
- Third-party browser apps should not call the API directly in v1 unless their origin is explicitly
  allowlisted.
- Integrations should call Argus from a server, CI job, incident automation, or secure backend.
