# Data Model

## Principles

- Important artifacts get their own tables; JSONB is for flexible payloads, not for hiding queryable state.
- Tool calls are the evidence boundary. Everything else cites them.
- `agent_outputs` are audit snapshots, not shared memory.
- `investigation_events` drives the live view and replay.

## Tables

| Table | Purpose | Notable columns |
| --- | --- | --- |
| `investigations` | One row per investigation | `status` (running, completed, failed, cancelled), `current_phase`, `current_round`, `trigger_payload`, `final_report`, `confidence`, `total_cost_usd` |
| `journal_entries` | Director's notes | type: decision, observation, finding, question, hypothesis, action, counter_evidence; may cite tool calls and findings |
| `review_findings` | Critic-scored Expert findings | `expert_name`, `credibility`, `credibility_band`, `cited_tool_calls`, `critic_notes` |
| `timeline_events` | Confirmed chronology | `event_timestamp`, `event_text`, `source_findings` |
| `timeline_metadata` | Per-investigation extras | `confidence_score`, `evidence_gaps` |
| `dissent_entries` | Counsel's objections | `counter_argument`, `dissent_strength`, `evidence_cited`, `director_response`, `resolved` |
| `tool_calls` | Persisted tool execution | `step_key`, `tool_name`, `arguments`, `result`, `error`, `duration_ms` |
| `agent_outputs` | Validated agent output | `agent_role`, `step_key`, `model_alias`, `model_id`, `prompt_version`, `input_snapshot`, `output_json`, `validation_error` |
| `investigation_events` | Append-only event stream | `sequence`, `event_type`, `payload` |
| `llm_calls` | Model accounting | tokens in/out, `cost_usd`, `duration_ms`, `trace_id` |

`tool_calls` and `agent_outputs` are unique on `(investigation_id, step_key)`.

## Credibility bands

| Band | Score |
| --- | --- |
| trustworthy | 0.90 to 1.00 |
| highly plausible | 0.70 to 0.89 |
| plausible | 0.50 to 0.69 |
| speculative | 0.30 to 0.49 |
| misguided | 0.00 to 0.29 |

Only findings at 0.50 or above feed the Timeline.

## Citation rules

- An Expert finding cites at least one tool call, unless it is an explicit "nothing found".
- A Critic review cites the tool calls it inspected.
- A Timeline event cites its source findings.
- A Counsel objection cites tool calls, findings, timeline events, or a concrete evidence gap.
- Every report claim appears in the report's `evidence_chain`.

```ts
type Citation = {
  claim: string
  sourceType: "tool_call" | "review_finding" | "timeline_event" | "dissent_entry"
  sourceId: string
  relevance: "direct" | "supporting" | "context" | "contradicting"
}
```

## Confidence inputs

Confidence is computed from evidence-chain coverage, credibility of the findings used in the verdict, and unresolved dissent. It is never derived from the Reporter's narrative. Formula: [engineering-standards.md](engineering-standards.md#confidence).
