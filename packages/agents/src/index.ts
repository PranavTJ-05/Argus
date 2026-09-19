import type { LlmGateway, LlmUsage } from "@argus/llm-gateway"
import type {
  AgentRole,
  CounselOutput,
  CriticOutput,
  DirectorAction,
  ExpertOutput,
  JsonValue,
  ModelAlias,
  ReporterOutput,
} from "@argus/shared-types"
import {
  counselOutputSchema,
  criticOutputSchema,
  directorActionSchema,
  expertOutputSchema,
  reporterOutputSchema,
} from "@argus/shared-types"
import type { z } from "zod"

export type ModelAliasResolver = Record<ModelAlias, string>

export type LiveAgentResult<T> = {
  modelAlias: ModelAlias
  modelId: string
  output: T
  promptVersion: string
  repaired: boolean
  usage: LlmUsage
  validationError: string | null
}

export type LiveAgentRunner = {
  runCounsel: (input: CounselAgentInput) => Promise<LiveAgentResult<CounselOutput>>
  runCritic: (input: CriticAgentInput) => Promise<LiveAgentResult<CriticOutput>>
  runDirector: (input: DirectorAgentInput) => Promise<LiveAgentResult<DirectorAction>>
  runReporter: (input: ReporterAgentInput) => Promise<LiveAgentResult<ReporterOutput>>
  runTraceExpert: (input: TraceExpertAgentInput) => Promise<LiveAgentResult<ExpertOutput>>
}

export type DirectorAgentInput = {
  currentPhase: string
  currentRound: number
  incidentId: string
  triggerPayload: JsonValue
}

export type TraceExpertAgentInput = {
  incidentId: string
  question: string
  toolCallId: string
  toolResult: JsonValue
}

export type CriticAgentInput = {
  expertName: AgentRole
  expertOutput: ExpertOutput
  inspectedToolCallId: string
  toolResult: JsonValue
}

export type CounselAgentInput = {
  evidenceGaps: string[]
  reviewFindingId: string
  timelineEventId: string
}

export type ReporterAgentInput = {
  confidence: number
  dissentEntryIds: string[]
  incidentId: string
  reviewFindingId: string
  timelineEventId: string
  timelineText: string
  timelineTimestamp: string
  toolCallId: string
}

export function createLiveAgentRunner(input: {
  gateway: LlmGateway
  modelAliases: ModelAliasResolver
}): LiveAgentRunner {
  return {
    runCounsel: (agentInput) =>
      generateAgentJson<CounselOutput>({
        gateway: input.gateway,
        input: agentInput,
        maxTokens: 1400,
        modelAlias: "counsel.balanced",
        modelAliases: input.modelAliases,
        prompt: counselPrompt(agentInput),
        promptVersion: "counsel.live.v1",
        schema: counselOutputSchema,
        system:
          "You are Counsel. Challenge the leading hypothesis and cite persisted evidence or evidence gaps.",
      }),
    runCritic: (agentInput) =>
      generateAgentJson<CriticOutput>({
        gateway: input.gateway,
        input: agentInput,
        modelAlias: "critic.balanced",
        modelAliases: input.modelAliases,
        prompt: criticPrompt(agentInput),
        promptVersion: "critic.live.v1",
        schema: criticOutputSchema,
        system:
          "You are Critic. Verify Expert findings only against inspected persisted tool results.",
      }),
    runDirector: (agentInput) =>
      generateAgentJson<DirectorAction>({
        gateway: input.gateway,
        input: agentInput,
        modelAlias: "director.primary",
        modelAliases: input.modelAliases,
        prompt: directorPrompt(agentInput),
        promptVersion: "director.live.v1",
        schema: directorActionSchema,
        system: "You are Director. Orchestrate the investigation and dispatch only useful experts.",
      }),
    runReporter: (agentInput) =>
      generateAgentJson<ReporterOutput>({
        gateway: input.gateway,
        input: agentInput,
        maxTokens: 2400,
        modelAlias: "reporter.primary",
        modelAliases: input.modelAliases,
        prompt: reporterPrompt(agentInput),
        promptVersion: "reporter.live.v1",
        schema: reporterOutputSchema,
        system:
          "You are Reporter. Write the final incident report using only cited persisted artifacts.",
      }),
    runTraceExpert: (agentInput) =>
      generateAgentJson<ExpertOutput>({
        gateway: input.gateway,
        input: agentInput,
        maxTokens: 700,
        modelAlias: "expert.cheap",
        modelAliases: input.modelAliases,
        prompt: traceExpertPrompt(agentInput),
        promptVersion: "trace-expert.live.v1",
        schema: expertOutputSchema,
        system:
          "You are Trace Expert. Summarize trace evidence and cite the inspected tool call IDs.",
      }),
  }
}

async function generateAgentJson<T>(input: {
  gateway: LlmGateway
  input: unknown
  maxTokens?: number
  modelAlias: ModelAlias
  modelAliases: ModelAliasResolver
  prompt: string
  promptVersion: string
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
  system: string
}): Promise<LiveAgentResult<T>> {
  const modelId = input.modelAliases[input.modelAlias]
  const request = {
    modelId,
    prompt: input.prompt,
    promptVersion: input.promptVersion,
    schema: input.schema,
    system: input.system,
  }
  const result = await input.gateway.generateStrictJson(
    input.maxTokens === undefined ? request : { ...request, maxTokens: input.maxTokens },
  )

  return {
    modelAlias: input.modelAlias,
    modelId,
    output: result.output as T,
    promptVersion: input.promptVersion,
    repaired: result.repaired,
    usage: result.usage,
    validationError: result.validationError,
  }
}

function directorPrompt(input: DirectorAgentInput): string {
  return [
    "Return JSON matching this TypeScript union:",
    '{ "type": "dispatch_experts", "experts": [{ "name": "trace_expert", "questions": ["..."] }] }',
    '{ "type": "write_journal", "entries": [{ "entryType": "hypothesis", "content": "...", "priority": "high", "citedToolCalls": [], "citedFindings": [] }] }',
    "",
    "For v1 Phase 9, dispatch trace_expert unless the incident is impossible to investigate.",
    `Incident ID: ${input.incidentId}`,
    `Current phase: ${input.currentPhase}`,
    `Current round: ${input.currentRound}`,
    `Trigger payload: ${JSON.stringify(input.triggerPayload)}`,
  ].join("\n")
}

function traceExpertPrompt(input: TraceExpertAgentInput): string {
  return [
    "Return exactly one JSON object with this shape:",
    "{",
    '  "findings": [',
    "    {",
    '      "text": "string",',
    `      "cited_tool_calls": ["${input.toolCallId}"],`,
    '      "confidence_note": "string"',
    "    }",
    "  ],",
    '  "no_findings": []',
    "}",
    "Rules:",
    "- Return findings when the tool result supports any useful observation.",
    "- Every finding must cite the provided toolCallId.",
    "- If there is no useful evidence, return findings: [] and one no_findings object.",
    "- Do not add markdown, prose, comments, or trailing commas.",
    `Incident ID: ${input.incidentId}`,
    `Question: ${input.question}`,
    `Tool call ID: ${input.toolCallId}`,
    `Tool result: ${JSON.stringify(input.toolResult)}`,
  ].join("\n")
}

function criticPrompt(input: CriticAgentInput): string {
  return [
    "Return exactly one JSON object with this shape:",
    "{",
    '  "reviewed_findings": [',
    "    {",
    '      "expert_name": "trace_expert",',
    '      "finding_text": "string",',
    '      "credibility": 0.86,',
    '      "credibility_band": "trustworthy|highly_plausible|plausible|speculative|misguided",',
    '      "cited_tool_calls": ["uuid"],',
    '      "critic_notes": "string"',
    "    }",
    "  ],",
    '  "timeline_events": [',
    "    {",
    '      "event_timestamp": "2026-05-23T00:00:00.000Z",',
    '      "event_text": "string",',
    '      "source_findings": ["uuid"]',
    "    }",
    "  ],",
    '  "evidence_gaps": ["string"]',
    "}",
    "Rules:",
    "- Use finding_text, not text.",
    "- credibility must be a decimal from 0 to 1, never a percentage.",
    "- event_timestamp must be valid ISO 8601 datetime.",
    "- source_findings must contain UUID strings; use the inspected tool call ID if no finding UUID exists yet.",
    "- Each reviewed finding must cite the inspected tool call ID.",
    `Expert name: ${input.expertName}`,
    `Expert output: ${JSON.stringify(input.expertOutput)}`,
    `Inspected tool call ID: ${input.inspectedToolCallId}`,
    `Inspected tool result: ${JSON.stringify(input.toolResult)}`,
  ].join("\n")
}

function counselPrompt(input: CounselAgentInput): string {
  return [
    "Return exactly one JSON object with this shape:",
    "{",
    '  "dissent_entries": [',
    "    {",
    '      "counter_argument": "string",',
    '      "dissent_strength": 0.45,',
    '      "evidence_cited": [',
    '        { "source_type": "evidence_gap", "description": "string" },',
    `        { "source_type": "review_finding", "source_id": "${input.reviewFindingId}", "description": "string" }`,
    "      ],",
    '      "proposed_alternative": "string"',
    "    }",
    "  ]",
    "}",
    "Rules:",
    '- If evidence gaps is empty, return exactly: {"dissent_entries":[]}',
    "- If evidence gaps is not empty, return exactly one dissent entry.",
    "- dissent_strength must be a decimal from 0 to 1.",
    "- evidence_cited must be an array of objects, not strings.",
    '- For every evidence-gap citation, use exactly: { "source_type": "evidence_gap", "description": "string" }',
    `- For review finding citation, use exactly: { "source_type": "review_finding", "source_id": "${input.reviewFindingId}", "description": "string" }`,
    '- source_type must be either "evidence_gap" or "review_finding".',
    "- source_id must be omitted for evidence_gap and must be the supplied UUID for review_finding.",
    "- proposed_alternative is optional, but if present must be a non-empty string.",
    "- Do not add markdown, prose, comments, or trailing commas.",
    `Evidence gaps: ${JSON.stringify(input.evidenceGaps)}`,
    `Review finding ID: ${input.reviewFindingId}`,
    `Timeline event ID: ${input.timelineEventId}`,
  ].join("\n")
}

function reporterPrompt(input: ReporterAgentInput): string {
  return [
    "Return exactly one JSON object with this shape:",
    "{",
    '  "verdict": "string",',
    `  "confidence": ${input.confidence},`,
    '  "timeline": [',
    "    {",
    `      "timestamp": "${input.timelineTimestamp}",`,
    '      "text": "string",',
    `      "source_ids": ["${input.timelineEventId}"]`,
    "    }",
    "  ],",
    '  "evidence_chain": [',
    `    { "claim": "string", "sourceType": "tool_call", "sourceId": "${input.toolCallId}", "relevance": "direct" },`,
    `    { "claim": "string", "sourceType": "review_finding", "sourceId": "${input.reviewFindingId}", "relevance": "supporting" },`,
    `    { "claim": "string", "sourceType": "timeline_event", "sourceId": "${input.timelineEventId}", "relevance": "context" }`,
    "  ],",
    '  "dissent_considered": "string",',
    '  "recommended_fix": {',
    '    "immediate": "string",',
    '    "long_term": "string"',
    "  }",
    "}",
    "Rules:",
    "- Use exactly these field names: sourceType and sourceId, not source_type or source_id.",
    '- sourceType must be one of "tool_call", "review_finding", "timeline_event", or "dissent_entry".',
    '- relevance must be one of "direct", "supporting", "context", or "contradicting".',
    "- sourceId values must be UUIDs from the supplied IDs only.",
    "- timeline timestamp must be the supplied ISO timestamp.",
    "- confidence must equal the supplied numeric confidence.",
    "- Do not add markdown, prose, comments, or trailing commas.",
    "- If dissent entries are present, summarize them in dissent_considered and optionally cite them in evidence_chain using sourceType dissent_entry.",
    `Incident ID: ${input.incidentId}`,
    `Confidence: ${input.confidence}`,
    `Tool call ID: ${input.toolCallId}`,
    `Review finding ID: ${input.reviewFindingId}`,
    `Timeline event ID: ${input.timelineEventId}`,
    `Timeline timestamp: ${input.timelineTimestamp}`,
    `Timeline text: ${input.timelineText}`,
    `Dissent entry IDs: ${JSON.stringify(input.dissentEntryIds)}`,
  ].join("\n")
}
