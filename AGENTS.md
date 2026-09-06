# Argus Agent Instructions

These instructions are for coding agents working in this repository. Read this file before changing code. Use `plan.md` as the product plan, and use the files in `docs/` as the stable engineering contracts.

## Project

Argus investigates production incidents with a multi-agent workflow:

- Director orchestrates the investigation.
- Experts gather evidence from traces, logs, metrics, deploys, flags, and code.
- Critic verifies Expert findings against cited tool results.
- Counsel argues against the Director's hypothesis and records dissent.
- Reporter writes the final incident report with citations and confidence.

The core product is not "chat with logs." The core product is citation-backed incident reasoning with adversarial dissent.

## Fixed Architecture

- Language: TypeScript.
- Production runtime: Node 22.
- Bun is allowed only for local scripts/tests/package execution. Do not use Bun-only APIs in service code.
- API server: Fastify.
- Durable workflow: Inngest.
- Database: Postgres 16 with Drizzle ORM.
- Schema validation: Zod everywhere.
- Logging: Pino.
- Observability: OpenTelemetry.
- Frontend: Next.js App Router, React, Tailwind, shadcn/ui.
- Realtime UI: Server-Sent Events, not WebSockets.
- Monorepo shape: `apps/` for services and UI, `packages/` for shared libraries.

Do not replace these choices unless the user explicitly asks for an architecture change.

## Service Boundaries

- API server owns HTTP, auth/rate limiting, request validation, read APIs, and SSE.
- Worker owns Inngest workflows, agent execution, tool execution, artifact writes, and state transitions.
- Dashboard only talks to the API server. It must not talk directly to Postgres or Inngest.
- Shared packages must be pure TypeScript libraries. They must not read environment variables at import time.

## Non-Negotiable Engineering Rules

- Every external input is validated with Zod.
- Every LLM output is strict JSON and must pass Zod validation before persistence.
- Validation failure gets one repair retry with the validation error included.
- All workflow writes must be idempotent by deterministic `step_key`.
- Tool calls are persisted before an agent summarizes them.
- Expert findings must cite tool call IDs.
- Critic and Counsel must inspect persisted tool results. They must not trust Expert summaries alone.
- Do not store raw chat history as primary workflow state.
- Store compact `agent_outputs` snapshots for audit and replay.
- Store `prompt_version`, `model_alias`, and concrete `model_id` with every agent output.
- Application code calls model aliases, not hard-coded model names.
- Use `investigation_events` as the source of truth for Live View and read-only Replay View.
- v1 replay is read-only. Do not implement branching replay unless explicitly requested.
- Secrets must come from environment variables or a secret manager, never committed config.

## Agent Workflow

The workflow phases are:

```text
TRIAGE -> TRACE -> VERDICT
```

The only context channels that propagate between rounds are:

- Journal
- Review
- Timeline
- Dissent Log

Do not pass unlimited raw transcript history between agents.

## Confidence

Do not use LLM self-confidence as the main confidence score. Confidence is computed from evidence quality and dissent:

```text
confidence = clamp(
  evidence_support * 0.60
  + critic_mean_credibility * 0.30
  - unresolved_dissent_strength * 0.40,
  0,
  1
)
```

## Build Order

Follow `docs/BUILD_ORDER.md`. Do not jump to dashboard polish, replay branching, or extra integrations before the core loop works.

The user may use short plain-text phase commands defined in `docs/PHASE_COMMANDS.md`, such as:

```text
next phase 0
status
review phase 0
fix phase 0
```

When the user gives one of these commands, read `docs/PHASE_COMMANDS.md` and `docs/PHASE_STATUS.md`, then follow that command. Update `docs/PHASE_STATUS.md` after completing phase work.

The first useful vertical slice is:

```text
POST /investigations
-> Inngest workflow
-> Director
-> one mocked Expert
-> Critic
-> Reporter
-> persisted report with citations
```

## Testing Expectations

- Add focused tests for schemas, workflow decisions, confidence calculation, and persistence helpers.
- Prefer Vitest for unit/integration tests.
- Use Playwright for browser-facing dashboard behavior.
- If a change touches agent contracts, update tests and docs together.

## Editing Rules

- Keep changes scoped to the current request.
- Prefer existing project patterns once the project has code.
- Do not introduce new frameworks casually.
- Do not silently change architecture decisions in `plan.md` or `docs/`.
- If a requested change conflicts with these instructions, explain the conflict and ask for confirmation.
