# Engineering Standards

These rules are binding. If code disagrees, fix the code, or change this page deliberately.

## Stack

TypeScript (strict), Node 22 in production, Fastify, Inngest, Postgres 16 with Drizzle, Zod, Pino, OpenTelemetry, SSE for realtime. Bun is acceptable for local scripts only, with no Bun-only APIs in service code.

## Validation

- Validate every API input, config file and LLM output with Zod.
- Persist only validated structured agent output.
- On an LLM validation failure, retry once with the error included. If that fails, record a structured failure event and follow workflow policy.

## Persistence

- Use first-class tables for first-class artifacts and JSONB for flexible payloads.
- Never use raw chat history as workflow state; store compact input and output snapshots instead.
- Store `prompt_version`, `model_alias` and `model_id` with every agent output, and tokens, cost, duration and trace ID with every LLM call.

## Idempotency

Steps can be retried, so every state-changing worker operation must be idempotent. Use deterministic keys:

```text
r{round}-director   r{round}-expert-{name}   r{round}-critic   r{round}-counsel   reporter
```

Enforce uniqueness on `(investigation_id, step_key)` where it makes sense, and never assume a step runs once.

## Tool calls

- Tools wrap external systems deterministically and never call LLMs.
- Enforce timeouts and result-size limits.
- Persist arguments, result or error, duration and `step_key` before any agent summarizes the result.

## Agent boundaries

Director orchestrates but does not read raw backend data. Experts gather and cite. Critic and Counsel inspect persisted tool results and must not trust Expert summaries. Reporter works from artifacts only.

## Model gateway

All provider access goes through the gateway: calls, timeouts, retries, structured-output repair, cost and token accounting, fallbacks. Agents never contain provider-specific code.

## Confidence

LLM self-confidence is never the final score.

```text
confidence = clamp(
  evidence_support * 0.60
  + critic_mean_credibility * 0.30
  - unresolved_dissent_strength * 0.40,
  0, 1)
```

- `evidence_support`: weighted share of verdict claims backed by credible findings.
- `critic_mean_credibility`: mean credibility of findings used in the verdict.
- `unresolved_dissent_strength`: strongest unresolved Counsel objection.

## Observability

Worker actions emit OTel spans with `investigation.id`, `agent.role`, `llm.model`, `llm.tokens.in`, `llm.tokens.out`, `llm.cost.usd`, `phase` and `round`.

## Secrets

Never commit real secrets. `.env.example` holds names and fake values only; runtime values come from the environment or a secret manager.

## Frontend

The dashboard talks only to the API. Use TanStack Query for server state, Zustand only for light UI state, SSE reconnect with the last sequence, and make evidence links open the stored tool call.
