# Production Hardening

Phase 12 makes the v1 workflow safer to run under retries, reconnects, and deploy automation.

## Inngest

The worker configures the Inngest client with:

- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_BASE_URL`
- checkpointing enabled
- development mode only when `NODE_ENV=development`

Workflow retries must be idempotent. Argus uses deterministic `step_key` values for tool calls and agent outputs, and completed or failed investigation retries return without writing duplicate artifacts.

## Health Checks

API:

```http
GET /health
```

Worker:

```bash
pnpm --filter @argus/worker build
pnpm --filter @argus/worker health
```

Dashboard:

```http
GET /api/health
```

## OpenTelemetry

Set:

```text
OTEL_SERVICE_NAME=argus
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
```

The API and worker now create stable service telemetry metadata. Full exporter SDK wiring can be added when the deployment target is chosen.

## SSE Reconnect

The API supports both:

```http
GET /investigations/:id/events?after=<sequence>
Last-Event-ID: <sequence>
```

The dashboard reconnects with the last received event sequence so replay/live view does not restart from zero after a dropped connection.

## Migrations

Before every production deploy:

```bash
pnpm db:migrate
```

Run migrations against the target `DATABASE_URL` before starting new API or worker instances. Do not run destructive schema changes without a rollback plan.

## Operational States

Investigation states are visible through the API and dashboard:

- `running`: partial investigation; live events may still arrive.
- `completed`: final report is available.
- `failed`: workflow failed; the error event is part of replay.
- `cancelled`: workflow stopped by request.
