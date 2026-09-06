# Engineering Rules

These are hard rules for building Argus. If code conflicts with this document, fix the code or update this document intentionally with a decision-log entry.

## Runtime and Stack

- Use TypeScript in strict mode.
- Production services run on Node 22.
- Bun may be used for local scripts, tests, and package execution only.
- Do not use Bun-only APIs in service code.
- Use Fastify for the API server.
- Use Inngest for durable workflows.
- Use Postgres 16 and Drizzle ORM for persistence.
- Use Zod for validation.
- Use Pino for structured logging.
- Use OpenTelemetry for tracing.
- Use SSE for realtime Dashboard updates, not WebSockets.

## Validation

- Validate every API input with Zod.
- Validate every config file with Zod.
- Validate every LLM output with Zod before persistence.
- Store only validated structured agent output.
- On LLM validation failure, perform one repair retry with the validation error included.
- If the repair retry fails, persist a structured failure event and fail or continue according to workflow policy.

## Persistence

- First-class artifacts get first-class tables.
- Use JSONB for flexible payloads, tool results, citation arrays, snapshots, and final report documents.
- Do not store raw chat history as the primary workflow state.
- Store compact agent input/output snapshots for audit and replay.
- Store `prompt_version`, `model_alias`, and concrete `model_id` for every agent output.
- Store LLM token counts, cost, duration, and trace ID for every LLM call.

## Idempotency

Workflow steps can be retried. All state-changing Worker operations must be idempotent.

Use deterministic `step_key` values like:

```text
r{round}-director
r{round}-expert-{expert_name}
r{round}-critic
r{round}-counsel
reporter
```

Tables that represent workflow outputs should enforce uniqueness by `(investigation_id, step_key)` where appropriate.

Never rely on "this step only runs once" as a correctness assumption.

## Tool Calls

- Tools are deterministic wrappers around external systems where possible.
- Tool implementations must not call LLMs.
- Tool calls must enforce timeouts.
- Tool calls must enforce result-size limits.
- Tool calls must persist arguments, result or error, duration, and `step_key`.
- Tool results must be persisted before an Expert summarizes them.
- Expert findings must cite persisted tool call IDs.

## Agent Boundaries

- Director orchestrates. It does not inspect raw backend data directly.
- Experts gather evidence and cite tool calls.
- Critic verifies Expert findings against cited tool results.
- Counsel challenges Director hypotheses using evidence or evidence gaps.
- Reporter writes the final report from artifacts only.

Critic and Counsel must inspect persisted tool results. They must not trust Expert summaries alone.

## Model Gateway

Application code calls model aliases:

- `director.primary`
- `expert.cheap`
- `critic.balanced`
- `counsel.balanced`
- `reporter.primary`

The LLM gateway maps aliases to concrete provider/model IDs.

The gateway owns:

- Provider calls.
- Timeouts.
- Retries.
- Structured-output repair.
- Cost tracking.
- Token accounting.
- Fallback hooks.

Do not scatter provider-specific code throughout agents.

## Confidence

Do not use LLM self-confidence as the final confidence score.

Use:

```text
confidence = clamp(
  evidence_support * 0.60
  + critic_mean_credibility * 0.30
  - unresolved_dissent_strength * 0.40,
  0,
  1
)
```

Definitions:

- `evidence_support`: weighted fraction of verdict claims backed by credible findings.
- `critic_mean_credibility`: mean credibility of findings used in the final verdict.
- `unresolved_dissent_strength`: strongest unresolved Counsel objection.

## Observability

Every Worker action should emit OTel spans.

Required span attributes where applicable:

- `investigation.id`
- `agent.role`
- `llm.model`
- `llm.tokens.in`
- `llm.tokens.out`
- `llm.cost.usd`
- `phase`
- `round`

## Secrets

- Never commit real secrets.
- Use `.env.example` for names and fake values.
- Runtime config must read from environment variables or the deployment secret manager.

## Frontend

- Dashboard talks only to the API server.
- Use TanStack Query for server cache.
- Use Zustand only for lightweight local UI state.
- Use SSE reconnect with last seen event sequence.
- Evidence links must open persisted tool call input/result.
