# Agent Contracts

## Rules for every agent

- Output is strict JSON validated by Zod before it is stored.
- Each prompt carries a `prompt_version`; each call writes an `agent_outputs` row and an `llm_calls` row.
- Agents get compact artifacts plus evidence handles, never full transcripts.
- Agents may not invent evidence IDs. Backend-derived claims cite persisted tool calls or derived findings.
- Code uses model aliases only: `director.primary`, `expert.cheap`, `critic.balanced`, `counsel.balanced`, `reporter.primary`.

## Director

Orchestrates. Never queries backends. Inputs: incident summary, Journal, Review, Timeline, Dissent Log, phase, round. Emits exactly one action:

```ts
type DirectorAction =
  | { type: "write_journal"; entries: JournalEntryInput[] }
  | { type: "dispatch_experts"; experts: ExpertDispatch[] }
  | { type: "advance_phase"; from: Phase; to: Phase; reason: string }
  | { type: "declare_verdict"; hypothesis: string }
```

The Director never sets final confidence; application code computes it.

## Experts

Domains: trace, log, metric, deploy, flag, code. Each gathers evidence with tools and cites tool call IDs. Raw tool results stay the source of truth, and Experts never score their own credibility.

```ts
type ExpertOutput = {
  findings: Array<{ text: string; cited_tool_calls: string[]; confidence_note?: string }>
  no_findings?: Array<{ searched: string; reason: string; cited_tool_calls: string[] }>
}
```

## Critic

Scores submitted findings and records gaps; creates no new findings.

```ts
type CriticOutput = {
  reviewed_findings: Array<{
    expert_name: string
    finding_text: string
    credibility: number
    credibility_band: "trustworthy" | "highly_plausible" | "plausible" | "speculative" | "misguided"
    cited_tool_calls: string[]
    critic_notes: string
  }>
  timeline_events: Array<{ event_timestamp: string; event_text: string; source_findings: string[] }>
  evidence_gaps: string[]
}
```

Bands follow [data-model.md](data-model.md#credibility-bands).

## Counsel

Argues against the Director's hypothesis: weak assumptions, contradictions, missing evidence, alternative causes, overconfidence. It argues hard but never fabricates evidence. Strength is 0.0 to 1.0, and strong dissent must cite strong evidence or a specific gap. Weak dissent can be dropped from the confidence formula after Critic review.

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

## Reporter

Writes from artifacts only, never gathers evidence, and uses the confidence passed in by application code. Every major claim must be in `evidence_chain`, and dissent must be reported along with how it was resolved or left open.

```ts
type ReporterOutput = {
  verdict: string
  confidence: number
  timeline: Array<{ timestamp: string; text: string; source_ids: string[] }>
  evidence_chain: Array<Citation>
  dissent_considered: string
  recommended_fix: { immediate: string; long_term: string }
}
```

## Prompt versions

Stable strings: `director.v1`, `trace-expert.v1`, `critic.v1`, `counsel.v1`, `reporter.v1`. Bump the version whenever behavior changes meaningfully.
