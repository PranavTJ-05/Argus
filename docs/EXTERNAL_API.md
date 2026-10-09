# External API

Argus exposes HTTP endpoints for creating investigations and reading investigation state, evidence, reports, and live events.

For a step-by-step integration walkthrough, see `docs/INTEGRATION_GUIDE.md`.

## Authentication

Production endpoints require a workspace API key created from the dashboard Setup panel. The older
deployment `API_KEY` is only a local-development fallback.

Use either header:

```http
Authorization: Bearer <WORKSPACE_API_KEY>
```

or:

```http
X-API-Key: <WORKSPACE_API_KEY>
```

Read endpoints require a dashboard session or workspace API key in authenticated launch deployments.
Requests are scoped to the workspace that owns the session or API key.

For a separately hosted dashboard, set `API_CORS_ORIGIN` on the API service to the dashboard origin,
for example `https://argus-dashboard.onrender.com`.

## Rate and Size Limits

`POST /investigations` is rate-limited per client IP and route.

Configured by:

```text
API_RATE_LIMIT_MAX=60
API_RATE_LIMIT_WINDOW_MS=60000
API_REQUEST_BODY_LIMIT_BYTES=65536
```

Rate-limited responses include `Retry-After` and `X-RateLimit-*` headers.

## Create Investigation

```http
POST /investigations
Content-Type: application/json
Authorization: Bearer <WORKSPACE_API_KEY>
```

Request:

```json
{
  "incidentId": "checkout-latency-2026-05-23",
  "triggerPayload": {
    "summary": "checkout p95 latency increased after deploy",
    "service": "checkout",
    "serviceName": "checkout",
    "severity": "high",
    "environment": "prod",
    "start": "2026-05-23T10:00:00.000Z",
    "end": "2026-05-23T10:30:00.000Z",
    "branch": "main",
    "deployRef": "2026.05.23",
    "commitSha": "abc1234",
    "logQuery": "{service=\"checkout\"}",
    "metricQuery": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service=\"checkout\"}[5m])) by (le))",
    "codePattern": "payment_authorize",
    "featureFlagContext": {
      "userSegment": "all"
    }
  }
}
```

Response `201`:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "incidentId": "checkout-latency-2026-05-23",
  "status": "running",
  "currentPhase": "triage",
  "currentRound": 0,
  "confidence": null,
  "totalCostUsd": null,
  "createdAt": "2026-05-23T10:00:00.000Z",
  "updatedAt": "2026-05-23T10:00:00.000Z"
}
```

## Read Investigation

```http
GET /investigations/:id
GET /investigations/:id/artifacts
GET /investigations/:id/report
GET /investigations/:id/tool-calls/:toolCallId
```

Pass the same `Authorization: Bearer <WORKSPACE_API_KEY>` header when reading from a backend
integration. The hosted dashboard reads through its login session instead.

Tool call responses include:

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "investigationId": "11111111-1111-4111-8111-111111111111",
  "stepKey": "r0-expert-trace_expert",
  "expertName": "trace_expert",
  "toolName": "evidence.bundle",
  "arguments": {
    "serviceName": "checkout"
  },
  "result": {
    "evidence": "normalized live evidence bundle"
  },
  "error": null,
  "durationMs": 42,
  "createdAt": "2026-05-23T10:00:01.000Z"
}
```

## Live Events

```http
GET /investigations/:id/events?after=0
Accept: text/event-stream
Authorization: Bearer <WORKSPACE_API_KEY>
```

The `after` cursor is the last seen event sequence. The response uses Server-Sent Events:

```text
id: 7
event: phase_changed
data: {"sequence":7,"eventType":"phase_changed"}
```

## Error Shape

Validation error:

```json
{
  "error": "validation_failed",
  "message": "request validation failed",
  "issues": [
    {
      "path": ["incidentId"],
      "code": "too_small",
      "message": "String must contain at least 1 character(s)"
    }
  ]
}
```

Unauthorized:

```json
{
  "error": "unauthorized",
  "message": "missing or invalid API key"
}
```

Rate limited:

```json
{
  "error": "rate_limited",
  "message": "rate limit exceeded",
  "retryAfterSeconds": 60
}
```

Payload too large:

```json
{
  "error": "payload_too_large",
  "message": "request body exceeds configured limit"
}
```

Not found:

```json
{
  "error": "not_found",
  "message": "investigation not found"
}
```
