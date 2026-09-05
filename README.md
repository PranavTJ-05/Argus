# Argus

Argus is a multi-agent incident investigation system. It receives a production incident, gathers evidence from observability systems, verifies findings, challenges the leading hypothesis, and writes a final report with citations and confidence.

![alt text](architecture.png)

The core product is citation-backed incident reasoning:

```text
Director -> Experts -> Critic -> Counsel -> Reporter
```

## Status

The foundation phases and the v1 launch path are implemented. See [docs/PHASE_STATUS.md](docs/PHASE_STATUS.md) and [docs/GAP_ANALYSIS.md](docs/GAP_ANALYSIS.md) for what is left.

Before changing code, read:

- [plan.md](plan.md)
- [AGENTS.md](AGENTS.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/ENGINEERING_RULES.md](docs/ENGINEERING_RULES.md)
- [docs/AGENT_PROTOCOL.md](docs/AGENT_PROTOCOL.md)
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- [docs/BUILD_ORDER.md](docs/BUILD_ORDER.md)
- [docs/GLOSSARY.md](docs/GLOSSARY.md)
- [docs/PHASE_COMMANDS.md](docs/PHASE_COMMANDS.md)
- [docs/PHASE_STATUS.md](docs/PHASE_STATUS.md)

## Fixed Stack

- TypeScript
- Node 22 for production services
- Fastify for the API server
- Inngest for durable workflows
- Postgres 16 with Drizzle ORM
- Zod for validation
- Anthropic SDK behind model aliases
- Pino for logging
- OpenTelemetry for tracing
- Next.js App Router for Dashboard
- SSE for realtime updates

## Architecture

```text
Incident source
  -> API server
  -> Inngest workflow
  -> Worker agents/tools
  -> Postgres artifacts/events
  -> Dashboard via API REST + SSE
```

The API server owns HTTP and reads. Worker owns agents, tools, workflows, and writes. Dashboard talks only to the API server.

## First Build Target

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

Do not start with dashboard polish or replay branching.

## Environment

Create a local env file from the example:

```bash
cp .env.example .env
```

Real secrets must never be committed.

## Build Order

Follow [docs/BUILD_ORDER.md](docs/BUILD_ORDER.md). Each phase should produce a working vertical slice before adding optional features.

## Local Demo and Evaluation

Run the reproducible local demo with [docs/LOCAL_DEMO.md](docs/LOCAL_DEMO.md).

Evaluation commands:

```bash
pnpm eval:smoke
pnpm eval:full path/to/full-dataset.json
```

## v1 Release Path

The foundation phases are complete. The live v1 path is tracked in:

- [docs/V1_RELEASE_PLAN.md](docs/V1_RELEASE_PLAN.md)
- [docs/V1_CREDENTIALS.md](docs/V1_CREDENTIALS.md)
- [docs/EXTERNAL_API.md](docs/EXTERNAL_API.md)
- [docs/PRODUCTION_HARDENING.md](docs/PRODUCTION_HARDENING.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/PHASE_STATUS.md](docs/PHASE_STATUS.md)

## Database

Drizzle migrations are generated from [packages/db/src/schema.ts](packages/db/src/schema.ts).

```bash
pnpm db:up
pnpm db:generate
pnpm db:migrate
```

`db:migrate` requires `DATABASE_URL` to point at a running Postgres database.

## Agentic Coding Commands

Use short commands instead of rewriting the plan each time:

```text
next phase 0
review phase 0
fix phase 0
status
```

See [docs/PHASE_COMMANDS.md](docs/PHASE_COMMANDS.md). Agents should update [docs/PHASE_STATUS.md](docs/PHASE_STATUS.md) after phase work.

## Author

Maintained by PranavTJ-05. Licensed under the [MIT License](LICENSE).
