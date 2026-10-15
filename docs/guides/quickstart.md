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

Set a real `ANTHROPIC_API_KEY` in `.env`. The worker runs the live agents, so a placeholder key makes every investigation fail with a 401. The apps read `.env` from their own working directory, so export it first with `set -a; source .env; set +a`. The worker and dashboard both default to port 3002, so set `WORKER_PORT` to something else, and start a local Inngest dev server with `npx inngest-cli@latest dev -u http://localhost:<WORKER_PORT>/api/inngest`.

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
