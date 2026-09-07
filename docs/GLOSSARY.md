# Glossary

This file defines common Argus terms in beginner-friendly language. Prefer these names in code and docs.

## API Server

The Fastify backend server. It is the front door of Argus.

Other common names for this are backend, server, REST API, API gateway, or application server.

Responsibilities:

- Receive `POST /investigations`.
- Start Inngest workflows.
- Serve investigation read APIs.
- Stream live events to the Dashboard over SSE.

The API server does not run long investigations itself.

## Worker

The background service that does long-running work.

Responsibilities:

- Run the Inngest workflow.
- Call LLM agents.
- Execute backend tools.
- Persist artifacts and events.

## Inngest

The durable workflow/background job system.

It lets Argus run a long investigation step by step and resume or retry if a step fails.

## Dashboard

The Next.js frontend.

It shows:

- investigation inbox,
- live investigation events,
- final reports,
- read-only replay.

## Artifact

A structured investigation object persisted in Postgres.

The four main artifacts are:

- Journal
- Review
- Timeline
- Dissent Log

## Journal

Director-owned working memory.

It contains decisions, observations, questions, hypotheses, actions, and counter-evidence.

## Review

Critic-owned verification results.

It scores Expert findings from 0.0 to 1.0 and records whether evidence supports the finding.

## Timeline

A chronological list of confirmed events.

Timeline events should come only from sufficiently credible findings.

## Dissent Log

Counsel-owned counterarguments.

It records objections to the Director's hypothesis, evidence for those objections, and Director responses.

## Tool Call

A persisted call to an external system such as Tempo, Loki, Prometheus, GitHub, or local git.

Tool calls are the raw evidence boundary. Expert findings and final report claims should cite tool calls.

## Model Alias

A stable name used in code instead of a concrete LLM model ID.

Examples:

- `director.primary`
- `expert.cheap`
- `critic.balanced`
- `counsel.balanced`
- `reporter.primary`

The gateway maps aliases to real model IDs.

## `step_key`

A deterministic key for workflow idempotency.

Example:

```text
r1-director
r1-expert-trace
r1-critic
reporter
```

If Inngest retries a step, `step_key` helps prevent duplicate writes.

## SSE

Server-Sent Events.

A simple one-way stream from the API server to the browser. Argus uses SSE for live investigation updates.

## Replay

In v1, replay means reading persisted `investigation_events` and `agent_outputs` to view what happened.

Replay does not mean branching or re-running from the middle. Branching is v2.

