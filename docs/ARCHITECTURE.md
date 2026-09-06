# Architecture

Argus is a multi-agent incident investigation system. It receives an incident, gathers evidence from observability systems, verifies findings, challenges the leading hypothesis, and writes a final report with citations.

## Core Idea

The system is built around adversarial, citation-backed reasoning:

- Experts collect evidence.
- Critic verifies the evidence.
- Counsel argues against the Director's hypothesis.
- Reporter writes the verdict.

The important output is not a fluent explanation. The important output is a report whose claims are tied to persisted tool calls and whose confidence is reduced by unresolved dissent.

## Services

```text
Incident source
  -> API server
  -> Inngest
  -> Worker
  -> Postgres
  -> Dashboard via API server
```

### API Server

The API server is the Fastify HTTP service.

Responsibilities:

- Validate incoming incident requests.
- Create investigations.
- Send Inngest events.
- Serve investigation read APIs.
- Serve artifact read APIs.
- Stream `investigation_events` over SSE.
- Own auth and rate limiting.

The API server must not execute agents or run observability tools.

### Worker

Worker is the Node 22 service that runs Inngest workflows.

Responsibilities:

- Execute durable investigation workflows.
- Run Director, Experts, Critic, Counsel, and Reporter.
- Execute backend tools.
- Persist artifacts, tool calls, agent outputs, LLM calls, and events.
- Emit OpenTelemetry spans.

Every Worker write must be idempotent by deterministic `step_key`.

### Dashboard

Dashboard is a Next.js App Router application.

Responsibilities:

- Investigation inbox.
- Live investigation view from SSE.
- Final report view.
- Read-only replay from persisted events.

Dashboard talks only to the API server. It must not access Postgres or Inngest directly.

## Packages

Expected monorepo layout:

```text
apps/
  api/
  worker/
  dashboard/
packages/
  shared-types/
  config/
  llm-gateway/
  agents/
  backends/
  db/
  otel/
eval/
infra/
docs/
```

Shared packages must be import-safe. They must not read environment variables at module import time.

## Investigation Phases

```text
TRIAGE -> TRACE -> VERDICT
```

### TRIAGE

Director broadcasts initial questions to Experts. Experts gather initial evidence. Critic scores findings. Director decides whether to deepen, pivot, or move toward a verdict.

### TRACE

Director asks targeted follow-up questions. Counsel becomes active and challenges the current hypothesis. This phase can run multiple rounds.

### VERDICT

Director declares a hypothesis. Counsel makes final dissent. Reporter writes the final report. If unresolved dissent is strong, the workflow can force another TRACE round before reporting.

## Context Channels

Only these artifacts propagate between rounds:

- Journal
- Review
- Timeline
- Dissent Log

Do not propagate unlimited raw chat history. Agents receive compact artifact summaries plus evidence handles.

## Event Model

`investigation_events` is the source of truth for Live View and read-only Replay View.

Important event types:

- `phase_changed`
- `agent_started`
- `agent_completed`
- `tool_started`
- `tool_completed`
- `artifact_written`
- `error`

SSE clients reconnect with the last seen sequence:

```text
GET /investigations/:id/events?after=<sequence>
```

The API server must replay missed events before streaming new ones.

## Replay

v1 replay is read-only and uses `investigation_events` plus `agent_outputs`.

Branching replay is v2. Do not implement branching unless the workflow and schema are explicitly extended for deterministic replay.
