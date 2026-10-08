# API Guide

How to send incidents to Argus and read results back.

## Authentication

1. Sign up on the dashboard and open **Setup**.
2. Create a workspace API key. It is shown once and stored hashed.
3. Send it on every call:

```http
Authorization: Bearer <WORKSPACE_API_KEY>
```

`X-API-Key: <key>` is also accepted. Keep keys on a server, CI job or automation, never in browser code. Reads are scoped to the workspace that owns the key or session. For a separately hosted dashboard, set `API_CORS_ORIGIN` on the API.

## Create an investigation

```sh
curl -sS "$API_BASE_URL/investigations" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $ARGUS_API_KEY" \
  -d '{
    "incidentId": "checkout-latency-2026-05-24",
    "triggerPayload": {
      "summary": "Checkout p95 latency increased during payment authorization.",
      "service": "checkout",
      "environment": "prod",
      "severity": "high",
      "start": "2026-05-24T06:00:00.000Z",
      "end": "2026-05-24T06:30:00.000Z",
      "branch": "main",
      "deployRef": "2026.05.24",
      "commitSha": "abc1234",
      "logQuery": "{service=\"checkout\"}",
      "metricQuery": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service=\"checkout\"}[5m])) by (le))",
      "codePattern": "payment_authorize"
    }
  }'
```

The `201` response contains the investigation `id`, `status: "running"`, `currentPhase: "triage"`, and null `confidence` until the report exists.

### Payload fields

| Field | Why it helps |
| --- | --- |
| `summary` | Human description of the incident |
| `service` / `serviceName`, `environment` | Scope the search |
| `start`, `end` | ISO time window for logs, metrics and traces |
| `logQuery`, `metricQuery` | Backend-specific queries |
| `deployRef`, `commitSha`, `branch` | Deploy and code context |
| `codePattern` | Function or keyword tied to the suspected failure |
| `featureFlagContext` | Flag rollout dimensions |

Missing context or integrations become evidence gaps; Argus does not invent evidence.

## Read results

| Endpoint | Returns |
| --- | --- |
| `GET /investigations/:id` | Status; terminal states are `completed`, `failed`, `cancelled` |
| `GET /investigations/:id/artifacts` | Journal, Review, Timeline, Dissent Log |
| `GET /investigations/:id/report` | Final cited report |
| `GET /investigations/:id/tool-calls/:toolCallId` | Arguments, result, error, duration of one tool call |
| `GET /investigations/:id/events?after=<seq>` | Live SSE stream |

SSE events look like:

```text
id: 7
event: phase_changed
data: {"sequence":7,"eventType":"phase_changed"}
```

After a dropped connection, pass the last seen sequence as `after` (or send `Last-Event-ID`).

## Limits

`POST /investigations` is rate limited by client IP and route, and by workspace or key identity when authenticated. Defaults: 60 requests per 60 seconds, 64 KB body. Rate-limited responses carry `Retry-After` and `X-RateLimit-*` headers.

## Errors

| Status | `error` | Meaning |
| --- | --- | --- |
| 400 | `validation_failed` | Bad request shape; `issues` lists the paths |
| 401 | `unauthorized` | Missing or invalid key or session |
| 404 | `not_found` | Unknown investigation or tool call |
| 413 | `payload_too_large` | Body over `API_REQUEST_BODY_LIMIT_BYTES` |
| 429 | `rate_limited` | Retry after `retryAfterSeconds` |

## Key hygiene

Rotate a key if it appears in a screenshot, log or chat, then revoke the old one from Setup.
