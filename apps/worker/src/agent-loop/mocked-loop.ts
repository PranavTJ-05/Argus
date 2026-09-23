import type { ArgusBackendRegistry } from "@argus/backends"
import type { ArgusConfig } from "@argus/config"
import type { InvestigationsRepository, ToolCallRecord } from "@argus/db"
import type {
  DissentEntryArtifact,
  InvestigationEvent,
  InvestigationSummary,
  JsonValue,
  ModelAlias,
  Phase,
  ReporterOutput,
  ReviewFindingArtifact,
  TimelineEventArtifact,
} from "@argus/shared-types"
import {
  counselOutputSchema,
  criticOutputSchema,
  directorActionSchema,
  expertOutputSchema,
  reporterOutputSchema,
} from "@argus/shared-types"

import { expertStepKey, reporterStepKey, roundStepKey } from "../workflow/step-keys.js"
import { computeConfidence } from "./confidence.js"

const traceExpert = "trace_expert"
const mockTraceToolName = "mock.trace_summary"

export type MockedAgentLoopDeps = {
  investigations: Pick<
    InvestigationsRepository,
    | "advancePhase"
    | "appendDissentEntry"
    | "appendEvent"
    | "appendJournalEntry"
    | "appendReviewFinding"
    | "appendTimelineEvent"
    | "completeInvestigation"
    | "upsertAgentOutput"
    | "upsertTimelineMetadata"
    | "upsertToolCall"
  >
  backends?: ArgusBackendRegistry
  modelAliases: ArgusConfig["llm"]["modelAliases"]
}

export type MockedAgentLoopResult = {
  report: ReporterOutput
  confidence: number
  completedStatus: InvestigationSummary["status"]
  eventSequence: number
}

type TraceRoundResult = {
  criticMeanCredibility: number
  evidenceGaps: string[]
  strongestUnresolvedDissent: number
  dissentEntries: DissentEntryArtifact[]
  reviewFinding: ReviewFindingArtifact
  timelineEvent: TimelineEventArtifact
  toolCall: ToolCallRecord
}

export async function runMockedAgentLoop(
  investigation: InvestigationSummary,
  triggerPayload: JsonValue,
  deps: MockedAgentLoopDeps,
): Promise<MockedAgentLoopResult> {
  let totalRounds = requestedRounds(triggerPayload)
  const traceResults: TraceRoundResult[] = []
  let currentEvent: InvestigationEvent | null = null

  for (let roundNumber = investigation.currentRound; roundNumber < totalRounds; roundNumber += 1) {
    await runDirectorRound(investigation, triggerPayload, roundNumber, deps)
    currentEvent = await transitionPhase(investigation.id, "triage", "trace", roundNumber, deps)

    const traceResult = await runTraceRound(investigation, roundNumber, deps)
    const counselResult = await runCounselRound(investigation, roundNumber, traceResult, deps)
    const roundResult = {
      ...traceResult,
      strongestUnresolvedDissent: counselResult.strongestUnresolvedDissent,
      dissentEntries: counselResult.dissentEntries,
    }
    traceResults.push(roundResult)

    await deps.investigations.upsertTimelineMetadata({
      investigationId: investigation.id,
      confidenceScore: roundResult.criticMeanCredibility,
      evidenceGaps: roundResult.evidenceGaps,
    })

    const forceDissentRound = shouldRunDissentTraceRound(roundNumber, roundResult)
    if (forceDissentRound) {
      totalRounds = Math.max(totalRounds, roundNumber + 2)
    }

    if (roundNumber < totalRounds - 1) {
      await deps.investigations.appendJournalEntry({
        investigationId: investigation.id,
        roundNumber,
        phase: "trace",
        entryType: "counter_evidence",
        content:
          "Director response: Counsel identified unresolved missing evidence, so run one more TRACE round before verdict.",
        priority: "medium",
        citedFindings: [roundResult.reviewFinding.id],
        citedToolCalls: [roundResult.toolCall.id],
      })
      currentEvent = await transitionPhase(
        investigation.id,
        "trace",
        "triage",
        roundNumber + 1,
        deps,
      )
      continue
    }

    currentEvent = await transitionPhase(investigation.id, "trace", "verdict", roundNumber, deps)
  }

  const finalTraceResult = traceResults.at(-1)
  if (!finalTraceResult) {
    throw new Error("phase machine produced no trace result")
  }

  const confidence = computeConfidence({
    evidenceSupport: 1,
    criticMeanCredibility: mean(traceResults.map((result) => result.criticMeanCredibility)),
    unresolvedDissentStrength: Math.max(
      ...traceResults.map((result) => result.strongestUnresolvedDissent),
    ),
  })
  const report = buildReporterOutput({
    confidence,
    dissentEntries: traceResults.flatMap((result) => result.dissentEntries),
    investigation,
    reviewFinding: finalTraceResult.reviewFinding,
    timelineEventId: finalTraceResult.timelineEvent.id,
    timelineTimestamp: finalTraceResult.timelineEvent.eventTimestamp,
    timelineText: finalTraceResult.timelineEvent.eventText,
    toolCallId: finalTraceResult.toolCall.id,
  })

  await deps.investigations.upsertAgentOutput({
    investigationId: investigation.id,
    roundNumber: totalRounds - 1,
    phase: "verdict",
    agentRole: "reporter",
    stepKey: reporterStepKey(),
    modelAlias: "reporter.primary",
    modelId: modelId(deps.modelAliases, "reporter.primary"),
    promptVersion: "reporter.v1",
    inputSnapshot: {
      confidence,
      reviewFindingId: finalTraceResult.reviewFinding.id,
      timelineEventId: finalTraceResult.timelineEvent.id,
    },
    outputJson: report as JsonValue,
    validationError: null,
  })

  const completed = await deps.investigations.completeInvestigation({
    id: investigation.id,
    finalReport: report,
    confidence,
  })

  const artifactEvent = await deps.investigations.appendEvent({
    investigationId: investigation.id,
    eventType: "artifact_written",
    payload: {
      artifactType: "final_report",
      confidence,
      stepKey: reporterStepKey(),
    },
  })

  return {
    report,
    confidence,
    completedStatus: completed.status,
    eventSequence: Math.max(currentEvent?.sequence ?? 0, artifactEvent.sequence),
  }
}

async function runDirectorRound(
  investigation: InvestigationSummary,
  triggerPayload: JsonValue,
  roundNumber: number,
  deps: MockedAgentLoopDeps,
): Promise<void> {
  const incidentSummary = summarizeTrigger(triggerPayload)
  const stepKey = roundStepKey(roundNumber, "director")

  await deps.investigations.appendEvent({
    investigationId: investigation.id,
    eventType: "agent_started",
    payload: {
      agentRole: "director",
      stepKey,
    },
  })

  const directorOutput = directorActionSchema.parse({
    type: "dispatch_experts",
    experts: [
      {
        name: traceExpert,
        questions: [
          `Round ${roundNumber + 1}: find trace evidence that explains incident ${investigation.incidentId}: ${incidentSummary}`,
        ],
      },
    ],
  })

  if (directorOutput.type !== "dispatch_experts") {
    throw new Error("mock director did not dispatch experts")
  }

  await deps.investigations.appendJournalEntry({
    investigationId: investigation.id,
    roundNumber,
    phase: "triage",
    entryType: "hypothesis",
    content: `Round ${roundNumber + 1} hypothesis for ${investigation.incidentId}: latency is concentrated in the checkout trace path.`,
    priority: "high",
  })

  await deps.investigations.upsertAgentOutput({
    investigationId: investigation.id,
    roundNumber,
    phase: "triage",
    agentRole: "director",
    stepKey,
    modelAlias: "director.primary",
    modelId: modelId(deps.modelAliases, "director.primary"),
    promptVersion: "director.v1",
    inputSnapshot: {
      incidentId: investigation.incidentId,
      triggerPayload,
      currentPhase: roundNumber === 0 ? investigation.currentPhase : "triage",
      currentRound: roundNumber,
    },
    outputJson: directorOutput as JsonValue,
    validationError: null,
  })

  await deps.investigations.appendEvent({
    investigationId: investigation.id,
    eventType: "agent_completed",
    payload: {
      agentRole: "director",
      stepKey,
    },
  })
}

async function runTraceRound(
  investigation: InvestigationSummary,
  roundNumber: number,
  deps: MockedAgentLoopDeps,
): Promise<TraceRoundResult> {
  const expertStep = expertStepKey(roundNumber, traceExpert)

  await deps.investigations.appendEvent({
    investigationId: investigation.id,
    eventType: "tool_started",
    payload: {
      expertName: traceExpert,
      stepKey: expertStep,
      toolName: mockTraceToolName,
    },
  })

  const rawTraceResult = await collectTraceEvidence(deps.backends, investigation.incidentId)
  const toolCall = await deps.investigations.upsertToolCall({
    investigationId: investigation.id,
    stepKey: expertStep,
    expertName: traceExpert,
    toolName: mockTraceToolName,
    arguments: {
      incidentId: investigation.incidentId,
      query: "checkout latency trace summary",
      roundNumber,
    },
    result: rawTraceResult,
    error: null,
    durationMs: 12,
  })

  await deps.investigations.appendEvent({
    investigationId: investigation.id,
    eventType: "tool_completed",
    payload: {
      expertName: traceExpert,
      stepKey: expertStep,
      toolName: mockTraceToolName,
      toolCallId: toolCall.id,
    },
  })

  const expertOutput = expertOutputSchema.parse({
    findings: [
      {
        text: "Checkout traces show p95 latency rose from 240ms to 1840ms, dominated by payment_authorize.",
        cited_tool_calls: [toolCall.id],
        confidence_note: "Trace summary directly supports the latency claim.",
      },
    ],
  })

  await deps.investigations.upsertAgentOutput({
    investigationId: investigation.id,
    roundNumber,
    phase: "trace",
    agentRole: traceExpert,
    stepKey: expertStep,
    modelAlias: "expert.cheap",
    modelId: modelId(deps.modelAliases, "expert.cheap"),
    promptVersion: "trace-expert.v1",
    inputSnapshot: {
      question: "Find trace evidence.",
      toolCallId: toolCall.id,
    },
    outputJson: expertOutput as JsonValue,
    validationError: null,
  })

  const finding = expertOutput.findings[0]
  if (!finding) {
    throw new Error("mock trace expert produced no finding")
  }

  const reviewFinding = await deps.investigations.appendReviewFinding({
    investigationId: investigation.id,
    roundNumber,
    expertName: traceExpert,
    findingText: finding.text,
    credibility: 0.86,
    credibilityBand: "highly_plausible",
    citedToolCalls: finding.cited_tool_calls,
    criticNotes: "The cited tool call directly reports the latency spike and dominant span.",
  })

  const timelineTimestamp = new Date()
  const timelineEvent = await deps.investigations.appendTimelineEvent({
    investigationId: investigation.id,
    roundNumber,
    eventTimestamp: timelineTimestamp,
    eventText: "Checkout p95 latency spiked and was dominated by payment_authorize spans.",
    sourceFindings: [reviewFinding.id],
  })

  const evidenceGaps =
    roundNumber === 0
      ? ["Deploy and flag evidence are not yet inspected in the Phase 5 mocked loop."]
      : []
  const criticOutput = criticOutputSchema.parse({
    reviewed_findings: [
      {
        expert_name: traceExpert,
        finding_text: reviewFinding.findingText,
        credibility: reviewFinding.credibility,
        credibility_band: reviewFinding.credibilityBand,
        cited_tool_calls: reviewFinding.citedToolCalls,
        critic_notes: reviewFinding.criticNotes,
      },
    ],
    timeline_events: [
      {
        event_timestamp: timelineEvent.eventTimestamp,
        event_text: timelineEvent.eventText,
        source_findings: timelineEvent.sourceFindings,
      },
    ],
    evidence_gaps: evidenceGaps,
  })

  await deps.investigations.upsertAgentOutput({
    investigationId: investigation.id,
    roundNumber,
    phase: "trace",
    agentRole: "critic",
    stepKey: roundStepKey(roundNumber, "critic"),
    modelAlias: "critic.balanced",
    modelId: modelId(deps.modelAliases, "critic.balanced"),
    promptVersion: "critic.v1",
    inputSnapshot: {
      expertFinding: finding as JsonValue,
      inspectedToolCallId: toolCall.id,
    },
    outputJson: criticOutput as JsonValue,
    validationError: null,
  })

  return {
    criticMeanCredibility: reviewFinding.credibility,
    dissentEntries: [],
    evidenceGaps,
    reviewFinding,
    strongestUnresolvedDissent: 0,
    timelineEvent,
    toolCall,
  }
}

async function runCounselRound(
  investigation: InvestigationSummary,
  roundNumber: number,
  traceResult: TraceRoundResult,
  deps: MockedAgentLoopDeps,
): Promise<Pick<TraceRoundResult, "dissentEntries" | "strongestUnresolvedDissent">> {
  const dissentStrength = traceResult.evidenceGaps.length > 0 ? 0.45 : 0
  const counselOutput = counselOutputSchema.parse({
    dissent_entries:
      dissentStrength > 0
        ? [
            {
              counter_argument:
                "The trace finding is credible, but deploy and flag evidence are still missing, so the root-cause claim may be incomplete.",
              dissent_strength: dissentStrength,
              evidence_cited: [
                {
                  source_type: "evidence_gap",
                  description: traceResult.evidenceGaps[0],
                },
                {
                  source_type: "review_finding",
                  source_id: traceResult.reviewFinding.id,
                  description: "Trace finding is credible but not sufficient by itself.",
                },
              ],
              proposed_alternative:
                "A recent deploy or flag change may have triggered the payment_authorize latency.",
            },
          ]
        : [],
  })

  await deps.investigations.upsertAgentOutput({
    investigationId: investigation.id,
    roundNumber,
    phase: "trace",
    agentRole: "counsel",
    stepKey: roundStepKey(roundNumber, "counsel"),
    modelAlias: "counsel.balanced",
    modelId: modelId(deps.modelAliases, "counsel.balanced"),
    promptVersion: "counsel.v1",
    inputSnapshot: {
      evidenceGaps: traceResult.evidenceGaps,
      reviewFindingId: traceResult.reviewFinding.id,
      timelineEventId: traceResult.timelineEvent.id,
    },
    outputJson: counselOutput as JsonValue,
    validationError: null,
  })

  const dissentEntries: DissentEntryArtifact[] = []
  for (const dissent of counselOutput.dissent_entries) {
    const persisted = await deps.investigations.appendDissentEntry({
      investigationId: investigation.id,
      roundNumber,
      counterArgument: dissent.counter_argument,
      dissentStrength: dissent.dissent_strength,
      evidenceCited: dissent.evidence_cited as JsonValue,
      directorResponse:
        "Director will run another TRACE round to test the missing deploy and flag evidence concern.",
      resolved: false,
    })
    dissentEntries.push(persisted)
  }

  return {
    dissentEntries,
    strongestUnresolvedDissent: Math.max(
      0,
      ...dissentEntries.filter((entry) => !entry.resolved).map((entry) => entry.dissentStrength),
    ),
  }
}

async function transitionPhase(
  investigationId: string,
  from: Phase,
  to: Phase,
  roundNumber: number,
  deps: MockedAgentLoopDeps,
): Promise<InvestigationEvent> {
  await deps.investigations.advancePhase({
    id: investigationId,
    phase: to,
    roundNumber,
  })

  return deps.investigations.appendEvent({
    investigationId,
    eventType: "phase_changed",
    payload: {
      from,
      to,
      roundNumber,
      reason: "phase machine transition",
    },
  })
}

function buildReporterOutput(input: {
  confidence: number
  dissentEntries: DissentEntryArtifact[]
  investigation: InvestigationSummary
  reviewFinding: ReviewFindingArtifact
  timelineEventId: string
  timelineTimestamp: string
  timelineText: string
  toolCallId: string
}): ReporterOutput {
  const strongestDissent = Math.max(
    0,
    ...input.dissentEntries.map((entry) => entry.dissentStrength),
  )
  return reporterOutputSchema.parse({
    verdict: `Incident ${input.investigation.incidentId} is most likely caused by elevated checkout latency in payment_authorize spans.`,
    confidence: input.confidence,
    timeline: [
      {
        timestamp: input.timelineTimestamp,
        text: input.timelineText,
        source_ids: [input.reviewFinding.id],
      },
    ],
    evidence_chain: [
      {
        claim: "Checkout latency increased sharply during the incident.",
        sourceType: "tool_call",
        sourceId: input.toolCallId,
        relevance: "direct",
      },
      {
        claim: "The Critic found the trace finding highly plausible.",
        sourceType: "review_finding",
        sourceId: input.reviewFinding.id,
        relevance: "supporting",
      },
      {
        claim: "The incident timeline includes the confirmed checkout latency spike.",
        sourceType: "timeline_event",
        sourceId: input.timelineEventId,
        relevance: "context",
      },
      ...input.dissentEntries.map((entry) => ({
        claim: "Counsel objected that missing evidence may weaken the verdict.",
        sourceType: "dissent_entry" as const,
        sourceId: entry.id,
        relevance: "contradicting" as const,
      })),
    ],
    dissent_considered:
      strongestDissent > 0
        ? `Counsel raised unresolved dissent with strength ${strongestDissent.toFixed(2)}; confidence was reduced and an extra TRACE round was run.`
        : "Counsel found no unresolved dissent strong enough to reduce confidence.",
    recommended_fix: {
      immediate:
        "Inspect the payment_authorize dependency and reduce checkout traffic pressure until latency returns to baseline.",
      long_term: "Add trace-backed regression checks for checkout payment authorization latency.",
    },
  })
}

function shouldRunDissentTraceRound(roundNumber: number, result: TraceRoundResult): boolean {
  return roundNumber === 0 && result.strongestUnresolvedDissent >= 0.4
}

function modelId(aliases: ArgusConfig["llm"]["modelAliases"], alias: ModelAlias): string {
  return aliases[alias]
}

function summarizeTrigger(triggerPayload: JsonValue): string {
  if (triggerPayload && typeof triggerPayload === "object" && !Array.isArray(triggerPayload)) {
    const summary = triggerPayload.summary
    if (typeof summary === "string" && summary.trim().length > 0) {
      return summary
    }
  }

  return "no trigger summary provided"
}

function requestedRounds(triggerPayload: JsonValue): number {
  if (triggerPayload && typeof triggerPayload === "object" && !Array.isArray(triggerPayload)) {
    const rounds = triggerPayload.rounds
    if (typeof rounds === "number" && Number.isInteger(rounds)) {
      return Math.min(Math.max(rounds, 1), 2)
    }

    if (triggerPayload.forceAdditionalRound === true) {
      return 2
    }
  }

  return 1
}

async function collectTraceEvidence(
  backends: ArgusBackendRegistry | undefined,
  incidentId: string,
): Promise<JsonValue> {
  if (backends?.traces) {
    return backends.traces.searchTraces({
      limit: 20,
      serviceName: "checkout",
    })
  }

  return {
    baselineP95Ms: 240,
    dominantSpan: "payment_authorize",
    evidence: "mocked trace backend returned a checkout latency spike",
    incidentId,
    operation: "POST /checkout",
    p95Ms: 1840,
    service: "checkout",
  }
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}
