# Quickstart

Run Argus locally and push a demo incident through it.

## Prerequisites

Node 22+, pnpm 10, and Docker running.

## Setup

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
```

Placeholder model keys are enough while the worker uses mocked agent output.

## Start the services

Use three terminals:

```bash
pnpm --filter @argus/api dev
pnpm --filter @argus/worker dev
pnpm --filter @argus/dashboard dev --hostname 127.0.0.1 --port 3002
```

The dashboard is at `http://127.0.0.1:3002` and reads the API from `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`).

## Send a demo incident

```bash
curl -X POST http://localhost:3001/investigations \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer dev_shared_api_key' \
  -d '{"incidentId":"checkout-latency-demo","triggerPayload":{"summary":"Checkout p95 latency spiked during payment authorization.","forceAdditionalRound":true}}'
```

The investigation appears in the inbox, streams events in Live View, and ends with a cited report.

## Evaluations

```bash
pnpm eval:smoke
pnpm eval:full path/to/dataset.json   # defaults to the smoke dataset when no path is given
```

## Useful scripts

| Command | Purpose |
| --- | --- |
| `pnpm check` | Typecheck, lint and test everything |
| `pnpm smoke:v1` | End-to-end check of a deployed stack |
| `pnpm smoke:launch` | Signup-to-report launch check |
| `pnpm demo:v1` | Seed the demo checkout-latency investigation |
