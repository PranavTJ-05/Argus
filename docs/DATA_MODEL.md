# Data Model

This document defines the persistence model and citation rules for Argus.

## Principles

- First-class artifacts use first-class tables.
- JSONB is for flexible payloads, not for hiding important queryable state.
- Every report claim should be traceable to evidence.
- Tool calls are the raw evidence boundary.
- Agent outputs are audited snapshots, not the primary shared memory.
- `investigation_events` drives Live View and read-only Replay View.

## Core Tables

### `investigations`

One row per investigation.

Important fields:

- `id`
- `incident_id`
- `status`: `running`, `completed`, `failed`, `cancelled`
- `current_phase`: `triage`, `trace`, `verdict`, `done`
- `current_round`
- `trigger_payload`
- `final_report`
- `confidence`
- `total_cost_usd`

### `journal_entries`

Director-owned working memory.

Entry types:

- `decision`
- `observation`
- `finding`
- `question`
- `hypothesis`
- `action`
- `counter_evidence`

Journal entries may cite:

- `cited_tool_calls`
- `cited_findings`

### `review_findings`

Critic-scored Expert findings.

Important fields:

- `expert_name`
- `finding_text`
- `credibility`
- `credibility_band`
- `cited_tool_calls`
- `critic_notes`

Credibility bands:

- `trustworthy`: 0.90-1.00
- `highly_plausible`: 0.70-0.89
- `plausible`: 0.50-0.69
- `speculative`: 0.30-0.49
- `misguided`: 0.00-0.29

Only findings with credibility >= 0.50 should be used to build the Timeline.

### `timeline_events`

Critic-generated chronology of confirmed events.

Important fields:

- `event_timestamp`
- `event_text`
- `source_findings`

### `timeline_metadata`

Investigation-level timeline metadata.

Important fields:

- `confidence_score`
- `evidence_gaps`

### `dissent_entries`

Counsel-owned counterarguments.

Important fields:

- `counter_argument`
- `dissent_strength`
- `evidence_cited`
- `director_response`
- `resolved`

Counsel dissent must cite evidence or a specific evidence gap.

### `tool_calls`

Persisted backend tool execution.

Important fields:

- `step_key`
- `expert_name`
- `tool_name`
- `arguments`
- `result`
- `error`
- `duration_ms`

Uniqueness:

```text
(investigation_id, step_key)
```

Tool calls are the primary evidence source for Experts, Critic, Counsel, Reporter, and the UI.

### `agent_outputs`

Validated structured output from an agent call.

Important fields:

- `round_number`
- `phase`
- `agent_role`
- `step_key`
- `model_alias`
- `model_id`
- `prompt_version`
- `input_snapshot`
- `output_json`
- `validation_error`

Uniqueness:

```text
(investigation_id, step_key)
```

Use this table for audit and read-only replay.

### `investigation_events`

Append-only event stream for Live View and Replay View.

Important fields:

- `sequence`
- `event_type`
- `payload`

Expected event types:

- `phase_changed`
- `agent_started`
- `agent_completed`
- `tool_started`
- `tool_completed`
- `artifact_written`
- `error`

Clients reconnect with the last seen sequence and the API server replays missed events.

### `llm_calls`

Accounting and tracing for model calls.

Important fields:

- `agent_role`
- `model_alias`
- `model`
- `input_tokens`
- `output_tokens`
- `cost_usd`
- `duration_ms`
- `trace_id`

## Citation Rules

Every Expert finding must cite at least one `tool_calls.id` unless the finding is explicitly "no evidence found."

Every Critic finding must cite the tool calls it inspected.

Every Timeline event must cite source findings.

Every Counsel dissent must cite either:

- tool call IDs,
- review finding IDs,
- timeline event IDs,
- or a concrete missing-evidence gap.

Every final report claim must be represented in `evidence_chain`.

## Evidence Chain Shape

Use this conceptual shape for final report evidence:

```ts
type Citation = {
  claim: string
  sourceType: "tool_call" | "review_finding" | "timeline_event" | "dissent_entry"
  sourceId: string
  relevance: "direct" | "supporting" | "context" | "contradicting"
}
```

## Confidence Inputs

Final confidence uses:

- verdict claims,
- evidence chain coverage,
- credibility scores for findings used in the verdict,
- unresolved dissent strength.

Do not compute confidence from the Reporter narrative alone.
