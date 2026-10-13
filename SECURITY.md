# Security Policy

Report vulnerabilities privately to the maintainer (PranavTJ-05) instead of opening a public issue. Include reproduction steps and the affected component (api, worker, dashboard).

Never commit real secrets. Production secrets (`INTEGRATION_SECRET_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, Inngest keys) must come from the host's secret manager. See `docs/SECURITY_REVIEW.md` for the current review.
