# Agent Protocol

This document defines the contracts for Argus's LLM agents.

## Shared Rules

- Every agent output must be strict JSON.
- Every output must be validated by Zod.
- Every prompt has a `prompt_version`.
- Every agent call stores an `agent_outputs` row.
- Every LLM call stores an `llm_calls` row.
- Agents receive compact artifacts plus evidence handles.
- Agents do not receive unlimited raw transcript history.
- Agents must not invent evidence IDs.
- Any claim based on backend data must cite persisted tool calls or derived findings.

## Model Aliases

Use model aliases in code:

- Director: `director.primary`
- Experts: `expert.cheap`
- Critic: `critic.balanced`
- Counsel: `counsel.balanced`
- Reporter: `reporter.primary`

The LLM gateway maps aliases to actual model IDs.

## Director

### Role

Director orchestrates the investigation.

Director decides:

- what questions to ask,
- which Experts to dispatch,
- when to advance phases,
- when to declare a verdict,
- how to respond to Counsel dissent.

Director does not query observability backends directly.

### Inputs

- Incident summary.
- Journal.
- Review.
- Timeline.
- Dissent Log.
- Current phase.
- Current round.

### Allowed Actions

Director must output exactly one action:

```ts
type DirectorAction =
  | { type: "write_journal"; entries: JournalEntryInput[] }
  | { type: "dispatch_experts"; experts: ExpertDispatch[] }
  | { type: "advance_phase"; from: Phase; to: Phase; reason: string }
  | { type: "declare_verdict"; hypothesis: string }
```

Do not let Director assign final confidence directly. Confidence is computed by deterministic application code.

## Experts

### Role

Experts gather evidence from one domain:

- Trace Expert
- Log Expert
- Metric Expert
- Deploy Expert
- Flag Expert
- Code Expert

### Inputs

- Director question.
- Relevant artifact summaries.
- Tool list for that Expert.
- Investigation metadata.

### Output

```ts
type ExpertOutput = {
  findings: Array<{
    text: string
    cited_tool_calls: string[]
    confidence_note?: string
  }>
  no_findings?: Array<{
    searched: string
    reason: string
    cited_tool_calls: string[]
  }>
}
```

### Rules

- Experts must use tools for backend evidence.
- Experts must cite tool call IDs for findings.
- Experts may summarize raw data, but raw tool results remain the source of truth.
- Experts must not score their own credibility for final confidence.

## Critic

### Role

Critic verifies Expert findings against cited evidence.

Critic does not create new findings. It scores submitted findings and records evidence gaps.

### Inputs

- Expert findings.
- Cited tool call IDs.
- Tool result inspection access.

### Output

```ts
type CriticOutput = {
  reviewed_findings: Array<{
    expert_name: string
    finding_text: string
    credibility: number
    credibility_band:
      | "trustworthy"
      | "highly_plausible"
      | "plausible"
      | "speculative"
      | "misguided"
    cited_tool_calls: string[]
    critic_notes: string
  }>
  timeline_events: Array<{
    event_timestamp: string
    event_text: string
    source_findings: string[]
  }>
  evidence_gaps: string[]
}
```

### Scoring

- 0.90-1.00: trustworthy
- 0.70-0.89: highly plausible
- 0.50-0.69: plausible
- 0.30-0.49: speculative
- 0.00-0.29: misguided

Only credibility >= 0.50 should be used for Timeline events.

## Counsel

### Role

Counsel is the adversarial agent. It argues against the Director's hypothesis.

Counsel looks for:

- weak assumptions,
- contradictory evidence,
- missing evidence,
- alternative explanations,
- overconfident conclusions.

### Inputs

- Current Director hypothesis.
- Journal.
- Review.
- Timeline.
- Previous Dissent Log.
- Tool/result inspection access.

### Output

```ts
type CounselOutput = {
  dissent_entries: Array<{
    counter_argument: string
    dissent_strength: number
    evidence_cited: Array<{
      source_type: "tool_call" | "review_finding" | "timeline_event" | "evidence_gap"
      source_id?: string
      description?: string
    }>
    proposed_alternative?: string
  }>
}
```

### Rules

- Counsel must argue hard, but not invent evidence.
- Dissent strength must be 0.0 to 1.0.
- Strong dissent must cite strong evidence or a concrete missing-evidence gap.
- Low-quality dissent can be excluded from the confidence formula after Critic review.

## Reporter

### Role

Reporter writes the final incident report from artifacts.

Reporter does not gather new evidence.

### Inputs

- Journal.
- Review.
- Timeline.
- Dissent Log.
- Computed confidence.

### Output

```ts
type ReporterOutput = {
  verdict: string
  confidence: number
  timeline: Array<{
    timestamp: string
    text: string
    source_ids: string[]
  }>
  evidence_chain: Array<{
    claim: string
    sourceType: "tool_call" | "review_finding" | "timeline_event" | "dissent_entry"
    sourceId: string
    relevance: "direct" | "supporting" | "context" | "contradicting"
  }>
  dissent_considered: string
  recommended_fix: {
    immediate: string
    long_term: string
  }
}
```

### Rules

- Every major claim must appear in `evidence_chain`.
- Reporter must include Counsel dissent and how it was resolved or left unresolved.
- Reporter must use the computed confidence passed by application code.

## Prompt Versioning

Prompt versions should be stable strings:

```text
director.v1
trace-expert.v1
critic.v1
counsel.v1
reporter.v1
```

When changing prompt behavior in a meaningful way, increment the version and add a short note in the relevant package changelog or docs.

