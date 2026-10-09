# v1 Integration Guide

This guide is for a developer integrating with a deployed Argus v1 instance.

Before integrating, read `docs/V1_LIMITATIONS.md` so you understand the current launch security
and evidence-coverage constraints.

## What Argus Does

Argus accepts an incident payload, runs a multi-agent investigation workflow, and produces a
citation-backed report. The report is useful only when the incident payload gives enough context
for the agents to query traces, logs, metrics, deploys, flags, or code integrations.

## Base URLs

Use the URLs from the deployment owner:

```text
API_BASE_URL=https://argus-api.example.com
DASHBOARD_URL=https://argus-dashboard.example.com
```

For the current hosted v1 deployment:

```text
API_BASE_URL=https://argus-api.onrender.com
DASHBOARD_URL=https://argus-dashboard.onrender.com
```

## Authentication

New customers start from the public dashboard URL:

1. Open `DASHBOARD_URL`.
2. Choose **Create workspace**.
3. Sign up with a work email, workspace name, and password.
4. Open **Setup** in the dashboard.
5. Create a workspace API key.

The raw key is shown only once. Store it in your alerting system, runbook automation, CI job, or
backend secret manager.

Write endpoints require a workspace API key:

```http
Authorization: Bearer <WORKSPACE_API_KEY>
```

The API also accepts:

```http
X-API-Key: <WORKSPACE_API_KEY>
```

Production deployments keep the older shared `API_KEY` only as a local-development fallback. Do not
use it as the customer integration key.

## Create An Investigation

```sh
curl -sS "$API_BASE_URL/investigations" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $ARGUS_API_KEY" \
  -d '{
    "incidentId": "checkout-latency-2026-05-24",
    "triggerPayload": {
      "summary": "Checkout p95 latency increased during payment authorization.",
      "service": "checkout",
      "serviceName": "checkout",
      "severity": "high",
      "environment": "prod",
      "start": "2026-05-24T06:00:00.000Z",
      "end": "2026-05-24T06:30:00.000Z",
      "branch": "main",
      "deployRef": "2026.05.24",
      "commitSha": "abc1234",
      "logQuery": "{service=\"checkout\"}",
      "metricQuery": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service=\"checkout\"}[5m])) by (le))",
      "codePattern": "payment_authorize",
      "featureFlagContext": {
        "userSegment": "all"
      }
    }
  }'
```

The response contains the `id` you use for reads:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "incidentId": "checkout-latency-2026-05-24",
  "status": "running",
  "currentPhase": "triage",
  "currentRound": 0,
  "confidence": null,
  "totalCostUsd": null,
  "createdAt": "2026-05-24T06:00:01.000Z",
  "updatedAt": "2026-05-24T06:00:01.000Z"
}
```

## Poll Status

```sh
curl -sS "$API_BASE_URL/investigations/$INVESTIGATION_ID" \
  -H "authorization: Bearer $ARGUS_API_KEY"
```

Terminal states:

- `completed`: final report is available.
- `failed`: workflow failed; inspect events and service logs.
- `cancelled`: workflow was cancelled.

## Stream Live Events

```sh
curl -N "$API_BASE_URL/investigations/$INVESTIGATION_ID/events?after=0" \
  -H "authorization: Bearer $ARGUS_API_KEY"
```

Each event is a Server-Sent Event:

```text
id: 7
event: phase_changed
data: {"sequence":7,"eventType":"phase_changed"}
```

On reconnect, pass the last seen sequence as `after`:

```sh
curl -N "$API_BASE_URL/investigations/$INVESTIGATION_ID/events?after=7" \
  -H "authorization: Bearer $ARGUS_API_KEY"
```

## Fetch Evidence And Report

Artifacts:

```sh
curl -sS "$API_BASE_URL/investigations/$INVESTIGATION_ID/artifacts" \
  -H "authorization: Bearer $ARGUS_API_KEY"
```

Final report:

```sh
curl -sS "$API_BASE_URL/investigations/$INVESTIGATION_ID/report" \
  -H "authorization: Bearer $ARGUS_API_KEY"
```

Tool call detail:

```sh
curl -sS "$API_BASE_URL/investigations/$INVESTIGATION_ID/tool-calls/$TOOL_CALL_ID" \
  -H "authorization: Bearer $ARGUS_API_KEY"
```

## Dashboard

Open the dashboard URL, create or log in to your workspace, and inspect the workspace's
investigations, live events, artifacts, evidence, and final reports. Dashboard access uses a login
session; customer systems use workspace API keys.

## Payload Guidance

Good incident payloads include:

- `summary`: human-readable incident summary.
- `service` or `serviceName`: affected service.
- `environment`: for example, `prod`.
- `start` and `end`: incident time window as ISO timestamps.
- `logQuery`: query for the relevant log backend.
- `metricQuery`: query for the relevant metrics backend.
- `deployRef`, `commitSha`, or `branch`: deploy and code context.
- `codePattern`: keyword or function name related to the suspected failure.
- `featureFlagContext`: useful flag rollout dimensions.

Missing integrations are treated as evidence gaps. Argus should not invent live evidence when
Tempo, Loki, Prometheus, GitHub, or flag credentials are not configured.

## First Real Evidence Integration: GitHub

GitHub is the recommended first evidence integration because it gives Argus deploy and code
context without requiring a full observability stack.

Open the dashboard Setup panel and save the GitHub owner, repo, and token for the workspace. The
token is encrypted before storage and is not returned to the browser after saving.

The token should have read access to the target repository. For a fine-grained GitHub token, grant
read-only repository contents access and Actions metadata access if deploy evidence should come from
GitHub Actions runs.

When GitHub is configured:

- deploy evidence is read from GitHub Actions workflow runs;
- code evidence is read from GitHub repository code search;
- `branch`, `deployRef`, `commitSha`, and `codePattern` in the incident payload make the evidence
  more specific;
- missing permissions or empty results are recorded as cited evidence gaps instead of fabricated
  evidence.

The Setup panel also accepts Prometheus, Loki, and Tempo endpoints per workspace. If they are not
configured for the workspace that owns an investigation, the report shows setup gaps instead of
using another workspace's credentials or global deployment credentials.

## Error Handling

Common errors:

- `401 unauthorized`: missing or wrong dashboard session or workspace API key.
- `400 validation_failed`: request shape is invalid.
- `413 payload_too_large`: body exceeds `API_REQUEST_BODY_LIMIT_BYTES`.
- `429 rate_limited`: retry after the response `Retry-After` value.
- `404 not_found`: investigation or tool call ID does not exist.

## Security Notes

- Do not put workspace API keys in browser-side code.
- Use workspace API keys from a server, CI job, incident automation, or secure backend.
- Rotate keys after accidental exposure in screenshots, logs, or chat.
- Revoke old keys from the dashboard Setup panel after rotation.
