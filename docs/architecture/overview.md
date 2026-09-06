# Architecture Overview

Argus takes an incident, collects evidence from observability systems, checks that evidence, argues against the leading theory, and writes a cited report. The output that matters is not fluent prose; it is a report whose claims trace back to stored tool results and whose confidence drops when objections remain.

## Request flow

```text
Incident source -> API server -> Inngest -> Worker -> Postgres -> Dashboard (via API)
```

## Services

| Service | Stack | Owns | Must not |
| --- | --- | --- | --- |
| API server | Fastify | Validation, auth, rate limits, investigation creation, read APIs, SSE | Run agents or call observability tools |
| Worker | Node 22 + Inngest | Durable workflows, agents, tools, all writes, OTel spans | Serve public HTTP beyond health and Inngest endpoints |
| Dashboard | Next.js App Router | Inbox, live view, report, read-only replay | Touch Postgres or Inngest directly |

Every worker write is idempotent through a deterministic `step_key`.

## Repository layout

```text
apps/       api, worker, dashboard
packages/   shared-types, config, llm-gateway, agents, backends, db, otel, evals
infra/      compose files and Render blueprints
docs/       this documentation
```

Shared packages are plain TypeScript libraries and never read environment variables at import time.

## The agent team

| Role | Job |
| --- | --- |
| Director | Orchestrates the investigation and proposes a hypothesis |
| Experts | Gather evidence per domain (traces, logs, metrics, deploys, flags, code) |
| Critic | Scores findings against the persisted tool results they cite |
| Counsel | Argues against the hypothesis and records dissent |
| Reporter | Writes the final report from stored artifacts only |

## Phases

```text
TRIAGE -> TRACE -> VERDICT
```

- **Triage:** Director poses initial questions, Experts gather evidence, Critic scores it, Director decides whether to dig deeper.
- **Trace:** targeted follow-ups run while Counsel challenges the hypothesis. May repeat for several rounds.
- **Verdict:** Director declares a hypothesis, Counsel gives a final dissent, Reporter writes the report. Strong unresolved dissent can force another Trace round.

## Context passed between rounds

Only four compact artifacts travel forward: the **Journal**, **Review**, **Timeline** and **Dissent Log**. Agents never receive an unbounded transcript.

## Events and replay

`investigation_events` is the single source of truth for the live view and for replay. Event types: `phase_changed`, `agent_started`, `agent_completed`, `tool_started`, `tool_completed`, `artifact_written`, `error`.

Clients reconnect with `GET /investigations/:id/events?after=<sequence>` (or `Last-Event-ID`) and the API replays anything missed before streaming new events. Replay in v1 is read-only, built from events plus `agent_outputs`. Branching replay is a future item.

## Glossary

| Term | Meaning |
| --- | --- |
| Artifact | A structured object stored in Postgres (Journal, Review, Timeline, Dissent Log) |
| Journal | Director's working memory: decisions, observations, hypotheses |
| Review | Critic's credibility scores for Expert findings |
| Timeline | Ordered list of confirmed events, built from credible findings only |
| Dissent Log | Counsel's objections, with evidence and Director responses |
| Tool call | A persisted call to Tempo, Loki, Prometheus, GitHub or local git; the raw evidence boundary |
| Model alias | Stable name such as `director.primary` that the gateway maps to a real model |
| `step_key` | Deterministic key (for example `r1-critic`) that makes retries safe |
| SSE | One-way server-sent event stream used for live updates |
