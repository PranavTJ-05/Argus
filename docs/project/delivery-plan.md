# Delivery Plan

Argus is built in vertical slices, and each phase leaves the repo working. Prove the investigation loop first; polish, replay branching and extra integrations come later.

First slice: `POST /investigations -> Inngest workflow -> Director -> one mocked Expert -> Critic -> Reporter -> persisted cited report`.

## Phases

| # | Phase | Outcome | Status |
| --- | --- | --- | --- |
| 0 | Monorepo and schemas | Strict TypeScript, workspace layout, Zod schemas, Drizzle schema, config loader, Vitest | Done |
| 1 | API and persistence | Migrations, create and read routes, SSE from events, validated payloads | Done |
| 2 | Durable workflow skeleton | Inngest handles `investigation.requested`, emits events, advances phases, enforces max rounds, honors cancellation, idempotent writes | Done |
| 3 | Mocked agent loop | Full loop end to end without real models | Done |
| 4 | Real observability backends | Tempo, Loki, Prometheus, GitHub and local git adapters | Done |
| 5 | Full phase machine | Triage, Trace and Verdict with round control | Done |
| 6 | Counsel and confidence | Dissent log and computed confidence | Done |
| 7 | Dashboard | Inbox, live view, report, read-only replay | Done |
| 8 | Evaluation and deployment | Smoke eval, local demo, container images | Done |
| 9 | Live LLM gateway and agents | Strict JSON agents through model aliases, one repair retry, audited outputs | Done |
| 10 | Live tool integrations | Adapters with timeouts and size limits; failures become cited gaps | Done |
| 11 | External integration API | Documented create, stream, inspect and report contracts | Done |
| 12 | Workflow hardening | Safe retries, duplicate events, SSE reconnect, migrations, observability | Done |
| 13 | Deployment | Real database, worker, API and dashboard | Done |
| 14 | v1 release gate | Checks, eval metrics, security review, docs, tag | Done |
| 15 | Dashboard clarity | Customer-language report, setup gaps, test runs labeled | Done |
| 16 | Create investigation UI | Form-based creation with friendly validation | Done |
| 17 | In-product integration guide | Setup panel with endpoints and curl examples | Done |
| 18 | First real evidence integration | GitHub evidence flowing into reports | Done |
| 19 | Demo dataset and pitch | Clean demo incident and pitch script | Done |
| 20 | Private beta readiness | Key rotation, read-risk handling, limits shown, onboarding checklist | Done |
| 21 | Single-tenant template | Repeatable per-company deployment | Done |
| 22 | Launch auth | Login, logout, protected dashboard, sessions | Done |
| 23 | Workspace isolation | Workspaces, scoped data and roles, isolation tests | Done |
| 24 | Workspace API keys | Create, rotate and revoke hashed keys; signup to first key flow | Done |
| 25 | Per-workspace credentials | Encrypted integration secrets resolved per workspace | Done |
| 26 | Usage and account controls | Per-workspace usage, limits, active, suspended and disabled states | Done |
| 27 | Security and reliability gate | Updated review, tested retries, launch smoke, Playwright | Done |
| 28 | Public launch readiness | Landing, signup, docs, runbooks, metrics, tag | Done |
| 29 | Dashboard stability | Stable layout, fixed skeletons, tablet support, performance budgets | Done |
| 30 | First-run activation | Guided checklist and safe demo investigation | Done |
| 31 | Demo-quality evidence | Scoped GitHub and deploy retrieval, classified gaps | Done |
| 32 | Report, replay and sharing | Customer-ready report, citation navigation, export, readable replay | Done |
| 33 | Operator support console | Support references, request IDs, Inngest lookup, cancel control | Done |
| 34 | First customer acceptance gate | Final go or no-go before customer outreach | Not started |

## Cut order

If scope grows, drop in this order: branching replay, Code Expert, a large real-incident dataset, a public hosted demo.

Never cut: Counsel, Critic with tool inspection, the eval harness, OTel instrumentation.

## Working with coding agents

Short plain-text commands steer agent work (do not prefix them with `/`):

| Command | Behavior |
| --- | --- |
| `next phase <n>` | Read AGENTS.md and the docs, do the next unfinished task in that phase only, run checks, update this table |
| `status` | Inspect the repo and report progress without editing |
| `review phase <n>` | Review against the standards and report bugs, gaps, drift and missing tests; no changes |
| `fix phase <n>` | Fix findings within that phase, run checks, update the table |

Typical loop: `next phase 0`, `review phase 0`, `fix phase 0`, then `next phase 1`.

Agents should use these docs as the source of truth, make the smallest useful vertical change, skip optional or v2 work, and leave architecture decisions alone unless told otherwise. If a phase is already done, say so and suggest the next one.
