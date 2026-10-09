# Local Demo

This is the reproducible local demo path for Argus v1.

## Prerequisites

- Node 22 or newer.
- pnpm 10.
- Docker Desktop running.

## Setup

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
```

For the mocked vertical slice, placeholder model keys are enough because the current worker uses mocked agent outputs.

## Run Services

Use separate terminals:

```bash
pnpm --filter @argus/api dev
pnpm --filter @argus/worker dev
pnpm --filter @argus/dashboard dev --hostname 127.0.0.1 --port 3002
```

Open the dashboard:

```text
http://127.0.0.1:3002
```

The dashboard reads the API URL from `NEXT_PUBLIC_API_URL`. The default local value is:

```text
http://localhost:3001
```

## Create a Demo Investigation

```bash
curl -X POST http://localhost:3001/investigations \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer dev_shared_api_key' \
  -d '{
    "incidentId": "checkout-latency-demo",
    "triggerPayload": {
      "summary": "Checkout p95 latency spiked during payment authorization.",
      "forceAdditionalRound": true
    }
  }'
```

The dashboard should show the investigation in Inbox, stream events in Live View, and show a report with citations after the worker completes the mocked investigation loop.

## Run Evaluation

Smoke eval:

```bash
pnpm eval:smoke
```

Full dataset eval:

```bash
pnpm eval:full path/to/full-dataset.json
```

If no dataset path is provided, `eval:full` uses the smoke dataset so the runner remains executable in a clean checkout.
