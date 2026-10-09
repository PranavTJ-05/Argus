# Security and Reliability

Posture for the v1 authenticated-workspace launch. Verdict: **pass for a controlled launch**. Wider multi-customer scale needs a shared rate-limit store and fuller account lifecycle flows.

## Review summary

| Area | Posture |
| --- | --- |
| Secrets | Only in environment or secret storage; `.env.example` has placeholders; config validated with Zod; production needs real model, database, Inngest and bootstrap credentials |
| Authentication | API-backed dashboard sessions in http-only cookies; workspace API keys hashed, shown once; integration secrets encrypted; production fails closed if the auth repository is missing |
| Data isolation | Creation, reads, artifacts, reports, tool calls and SSE are all workspace-scoped |
| Rate and size limits | Per IP and route for the fallback key, per workspace or key identity when authenticated; body size capped by `API_REQUEST_BODY_LIMIT_BYTES` |
| CORS | Explicit allowlist via `API_CORS_ORIGIN`; untrusted origins get no CORS headers (tested) |
| Validation | Zod on routes, queries, bodies, responses, worker events and LLM output; one repair retry, then a conservative fallback instead of storing unvalidated text |
| Migrations | Append-only SQL; the workspace status column defaults to `active`; rollback means restoring the pre-migration backup and redeploying the old commit |
| Reliability | Tests cover idempotent no-ops for finished or failed retries and cancellation; `smoke-launch` covers login, key creation, investigation, report and dashboard health |

## Hardening in place

- **Inngest:** configured with event and signing keys, checkpointing on, dev mode only when `NODE_ENV=development`.
- **SSE:** reconnect through `after` or `Last-Event-ID`, so the live view resumes instead of restarting.
- **Telemetry:** stable service metadata for API and worker; point `OTEL_EXPORTER_OTLP_ENDPOINT` at your collector (full exporter wiring is a follow-up).
- **States:** `running`, `completed`, `failed` (error event kept in replay) and `cancelled` are visible in API and dashboard.

## Required before a broad public launch

1. Move rate limiting from in-memory buckets to Redis or similar, since in-memory limits break across multiple instances.
2. Add production signup, invite and password reset flows.
3. Add per-tenant CORS allowlists for browser-based third-party integrations.

See [../product/limitations-and-roadmap.md](../product/limitations-and-roadmap.md) for the full list.
