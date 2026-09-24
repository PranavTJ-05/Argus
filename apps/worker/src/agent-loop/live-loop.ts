import type { LiveAgentResult, LiveAgentRunner } from "@argus/agents"
import type { ArgusBackendRegistry } from "@argus/backends"
import type { InvestigationsRepository, ToolCallRecord } from "@argus/db"
import { StrictJsonGenerationError } from "@argus/llm-gateway"
import type {
  AgentRole,
  CriticOutput,
  DissentEntryArtifact,
  ExpertOutput,
  InvestigationEvent,
  InvestigationSummary,
  JsonValue,
  Phase,
  ReporterOutput,
  ReviewFindingArtifact,
  TimelineEventArtifact,
} from "@argus/shared-types"
import { reporterOutputSchema } from "@argus/shared-types"

import { expertStepKey, reporterStepKey, roundStepKey } from "../workflow/step-keys.js"
import { computeConfidence } from "./confidence.js"

const traceExpert = "trace_expert"
const traceToolName = "evidence.bundle"

export type LiveAgentLoopDeps = {
  agents: LiveAgentRunner
  backends?: ArgusBackendRegistry
  investigations: Pick<
    InvestigationsRepository,
    | "advancePhase"
    | "appendDissentEntry"
    | "appendEvent"
    | "appendJournalEntry"
    | "appendLlmCall"
    | "appendReviewFinding"
    | "appendTimelineEvent"
    | "completeInvestigation"
    | "upsertAgentOutput"
    | "upsertTimelineMetadata"
    | "upsertToolCall"
  >
}

export type LiveAgentLoopResult = {
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

export async function runLiveAgentLoop(
  investigation: InvestigationSummary,
  triggerPayload: JsonValue,
  deps: LiveAgentLoopDeps,
): Promise<LiveAgentLoopResult> {
  const traceResults: TraceRoundResult[] = []
  let currentEvent: InvestigationEvent | null = null
  let totalRounds = requestedRounds(triggerPayload)

  for (let roundNumber = investigation.currentRound; roundNumber < totalRounds; roundNumber += 1) {
    const director = await deps.agents.runDirector({
      currentPhase: roundNumber === 0 ? investigation.currentPhase : "triage",
      currentRound: roundNumber,
      incidentId: investigation.incidentId,
      triggerPayload,
    })
    await persistAgentOutput(deps, investigation.id, roundNumber, "triage", "director", director, {
      currentRound: roundNumber,
      incidentId: investigation.incidentId,
      triggerPayload,
    })

    if (director.output.type === "write_journal") {
      for (const entry of director.output.entries) {
        await deps.investigations.appendJournalEntry({
          investigationId: investigation.id,
          roundNumber,
          phase: "triage",
          entryType: entry.entryType,
          content: entry.content,
          citedFindings: entry.citedFindings,
          citedToolCalls: entry.citedToolCalls,
          ...(entry.priority ? { priority: entry.priority } : {}),
        })
      }
      throw new Error("live Director must dispatch trace_expert for Phase 9 vertical slice")
    }

    if (director.output.type === "advance_phase" || director.output.type === "declare_verdict") {
      throw new Error("live Director cannot advance phase directly in Phase 9 vertical slice")
    }

    const traceQuestion =
      director.output.experts.find((expert) => expert.name === traceExpert)?.questions[0] ??
      `Find trace evidence for incident ${investigation.incidentId}.`

    await deps.investigations.appendJournalEntry({
      investigationId: investigation.id,
      roundNumber,
      phase: "triage",
      entryType: "hypothesis",
      content: traceQuestion,
      priority: "high",
    })

    currentEvent = await transitionPhase(investigation.id, "triage", "trace", roundNumber, deps)
    const traceResult = await runTraceRound(
      investigation,
      roundNumber,
      traceQuestion,
      triggerPayload,
      deps,
    )
    const counselResult = await runCounselRound(investigation, roundNumber, traceResult, deps)
    const roundResult = {
      ...traceResult,
      dissentEntries: counselResult.dissentEntries,
      strongestUnresolvedDissent: counselResult.strongestUnresolvedDissent,
    }
    traceResults.push(roundResult)

    await deps.investigations.upsertTimelineMetadata({
      investigationId: investigation.id,
      confidenceScore: roundResult.criticMeanCredibility,
      evidenceGaps: roundResult.evidenceGaps,
    })

    if (roundNumber === 0 && roundResult.strongestUnresolvedDissent >= 0.4) {
      totalRounds = Math.max(totalRounds, 2)
    }

    if (roundNumber < totalRounds - 1) {
      await deps.investigations.appendJournalEntry({
        investigationId: investigation.id,
        roundNumber,
        phase: "trace",
        entryType: "counter_evidence",
        content:
          "Director response: Counsel identified unresolved dissent, so run one more TRACE round before verdict.",
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
    throw new Error("live phase machine produced no trace result")
  }

  const confidence = computeConfidence({
    evidenceSupport: 1,
    criticMeanCredibility: mean(traceResults.map((result) => result.criticMeanCredibility)),
    unresolvedDissentStrength: Math.max(
      0,
      ...traceResults.map((result) => result.strongestUnresolvedDissent),
    ),
  })
  const reporter = await deps.agents.runReporter({
    confidence,
    dissentEntryIds: traceResults.flatMap((result) =>
      result.dissentEntries.map((entry) => entry.id),
    ),
    incidentId: investigation.incidentId,
    reviewFindingId: finalTraceResult.reviewFinding.id,
    timelineEventId: finalTraceResult.timelineEvent.id,
    timelineText: finalTraceResult.timelineEvent.eventText,
    timelineTimestamp: finalTraceResult.timelineEvent.eventTimestamp,
    toolCallId: finalTraceResult.toolCall.id,
  })
  const report = reporterOutputSchema.parse({
    ...reporter.output,
    confidence,
  })

  await persistAgentOutput(
    deps,
    investigation.id,
    totalRounds - 1,
    "verdict",
    "reporter",
    reporter,
    {
      confidence,
      reviewFindingId: finalTraceResult.reviewFinding.id,
      timelineEventId: finalTraceResult.timelineEvent.id,
    },
  )

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

async function runTraceRound(
  investigation: InvestigationSummary,
  roundNumber: number,
  question: string,
  triggerPayload: JsonValue,
  deps: LiveAgentLoopDeps,
): Promise<TraceRoundResult> {
  const stepKey = expertStepKey(roundNumber, traceExpert)

  await deps.investigations.appendEvent({
    investigationId: investigation.id,
    eventType: "tool_started",
    payload: {
      expertName: traceExpert,
      stepKey,
      toolName: traceToolName,
    },
  })
  const startedAt = Date.now()
  const rawTraceResult = await collectLiveEvidence(
    deps.backends,
    investigation.incidentId,
    question,
    triggerPayload,
  )
  const toolErrors = collectToolErrors(rawTraceResult)
  const requestedServiceName =
    readString(triggerPayload, "serviceName") ?? readString(triggerPayload, "service")
  const toolArguments: JsonValue = requestedServiceName
    ? {
        incidentId: investigation.incidentId,
        query: question,
        roundNumber,
        serviceName: requestedServiceName,
      }
    : {
        incidentId: investigation.incidentId,
        query: question,
        roundNumber,
      }
  const toolCall = await deps.investigations.upsertToolCall({
    investigationId: investigation.id,
    stepKey,
    expertName: traceExpert,
    toolName: "evidence.bundle",
    arguments: toolArguments,
    result: rawTraceResult,
    error: toolErrors.length ? toolErrors.join("; ") : null,
    durationMs: Date.now() - startedAt,
  })
  await deps.investigations.appendEvent({
    investigationId: investigation.id,
    eventType: "tool_completed",
    payload: {
      expertName: traceExpert,
      stepKey,
      toolCallId: toolCall.id,
      toolName: "evidence.bundle",
    },
  })

  const expert = await runTraceExpertWithFallback(deps.agents, {
    incidentId: investigation.incidentId,
    question,
    toolCallId: toolCall.id,
    toolResult: rawTraceResult,
  })
  await persistAgentOutput(deps, investigation.id, roundNumber, "trace", traceExpert, expert, {
    question,
    toolCallId: toolCall.id,
  })

  const finding = firstFinding(expert.output, toolCall.id)
  const critic = await runCriticWithFallback(deps.agents, {
    expertName: traceExpert,
    expertOutput: expert.output,
    inspectedToolCallId: toolCall.id,
    toolResult: rawTraceResult,
  })
  await persistAgentOutput(deps, investigation.id, roundNumber, "trace", "critic", critic, {
    inspectedToolCallId: toolCall.id,
  })

  const criticFinding = firstReviewedFinding(critic.output, finding.text, toolCall.id)
  const reviewFinding = await deps.investigations.appendReviewFinding({
    investigationId: investigation.id,
    roundNumber,
    expertName: traceExpert,
    findingText: criticFinding.finding_text,
    credibility: criticFinding.credibility,
    credibilityBand: criticFinding.credibility_band,
    citedToolCalls: criticFinding.cited_tool_calls.length
      ? criticFinding.cited_tool_calls
      : [toolCall.id],
    criticNotes: criticFinding.critic_notes,
  })
  const criticTimeline = critic.output.timeline_events[0]
  const timelineEvent = await deps.investigations.appendTimelineEvent({
    investigationId: investigation.id,
    roundNumber,
    eventTimestamp: criticTimeline ? new Date(criticTimeline.event_timestamp) : new Date(),
    eventText: criticTimeline?.event_text ?? criticFinding.finding_text,
    sourceFindings: [reviewFinding.id],
  })

  return {
    criticMeanCredibility: reviewFinding.credibility,
    dissentEntries: [],
    evidenceGaps: [...critic.output.evidence_gaps, ...toolErrors],
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
  deps: LiveAgentLoopDeps,
): Promise<Pick<TraceRoundResult, "dissentEntries" | "strongestUnresolvedDissent">> {
  const counsel = await runCounselWithFallback(deps.agents, {
    evidenceGaps: traceResult.evidenceGaps,
    reviewFindingId: traceResult.reviewFinding.id,
    timelineEventId: traceResult.timelineEvent.id,
  })
  await persistAgentOutput(deps, investigation.id, roundNumber, "trace", "counsel", counsel, {
    evidenceGaps: traceResult.evidenceGaps,
    reviewFindingId: traceResult.reviewFinding.id,
    timelineEventId: traceResult.timelineEvent.id,
  })

  const dissentEntries: DissentEntryArtifact[] = []
  for (const dissent of counsel.output.dissent_entries) {
    const persisted = await deps.investigations.appendDissentEntry({
      investigationId: investigation.id,
      roundNumber,
      counterArgument: dissent.counter_argument,
      dissentStrength: dissent.dissent_strength,
      evidenceCited: dissent.evidence_cited as JsonValue,
      directorResponse:
        dissent.dissent_strength >= 0.4
          ? "Director will run another TRACE round to test this dissent."
          : "Director recorded dissent without forcing another round.",
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

async function runTraceExpertWithFallback(
  agents: LiveAgentRunner,
  input: Parameters<LiveAgentRunner["runTraceExpert"]>[0],
): Promise<LiveAgentResult<ExpertOutput>> {
  try {
    return await agents.runTraceExpert(input)
  } catch (error) {
    if (!(error instanceof StrictJsonGenerationError)) {
      throw error
    }

    return fallbackAgentResult({
      modelAlias: "expert.cheap",
      output: {
        findings: [
          {
            cited_tool_calls: [input.toolCallId],
            confidence_note:
              "Trace Expert output failed strict JSON validation; using cited fallback summary.",
            text: "Evidence bundle was collected, but the Trace Expert response could not be validated. Treat findings as evidence-gap driven until live evidence is configured.",
          },
        ],
        no_findings: [],
      },
      promptVersion: "trace-expert.live.fallback.v1",
      validationError: error.validationError,
    })
  }
}

async function runCriticWithFallback(
  agents: LiveAgentRunner,
  input: Parameters<LiveAgentRunner["runCritic"]>[0],
): Promise<LiveAgentResult<CriticOutput>> {
  try {
    return await agents.runCritic(input)
  } catch (error) {
    if (!(error instanceof StrictJsonGenerationError)) {
      throw error
    }

    const finding = firstFinding(input.expertOutput, input.inspectedToolCallId)

    return fallbackAgentResult({
      modelAlias: "critic.balanced",
      output: {
        evidence_gaps: [
          "Critic output failed strict JSON validation; credibility is conservatively reduced.",
        ],
        reviewed_findings: [
          {
            cited_tool_calls: [input.inspectedToolCallId],
            credibility: 0.2,
            credibility_band: "speculative",
            critic_notes:
              "Fallback Critic result generated because the model response failed strict JSON validation.",
            expert_name: traceExpert,
            finding_text: finding.text,
          },
        ],
        timeline_events: [
          {
            event_text: finding.text,
            event_timestamp: new Date().toISOString(),
            source_findings: [input.inspectedToolCallId],
          },
        ],
      },
      promptVersion: "critic.live.fallback.v1",
      validationError: error.validationError,
    })
  }
}

async function runCounselWithFallback(
  agents: LiveAgentRunner,
  input: Parameters<LiveAgentRunner["runCounsel"]>[0],
): Promise<LiveAgentResult<Awaited<ReturnType<LiveAgentRunner["runCounsel"]>>["output"]>> {
  try {
    return await agents.runCounsel(input)
  } catch (error) {
    if (!(error instanceof StrictJsonGenerationError)) {
      throw error
    }

    return fallbackAgentResult({
      modelAlias: "counsel.balanced",
      output: {
        dissent_entries: input.evidenceGaps.length
          ? [
              {
                counter_argument:
                  "Evidence gaps remain unresolved, so the leading hypothesis should be treated as unconfirmed.",
                dissent_strength: 0.8,
                evidence_cited: [
                  ...input.evidenceGaps.slice(0, 5).map((gap) => ({
                    description: gap,
                    source_type: "evidence_gap" as const,
                  })),
                  {
                    description:
                      "Review finding requires caution because Counsel output needed fallback handling.",
                    source_id: input.reviewFindingId,
                    source_type: "review_finding" as const,
                  },
                ],
                proposed_alternative:
                  "Configure live traces, logs, and metrics before assigning a definitive root cause.",
              },
            ]
          : [],
      },
      promptVersion: "counsel.live.fallback.v1",
      validationError: error.validationError,
    })
  }
}

function fallbackAgentResult<T>(input: {
  modelAlias: LiveAgentResult<T>["modelAlias"]
  output: T
  promptVersion: string
  validationError: string
}): LiveAgentResult<T> {
  return {
    modelAlias: input.modelAlias,
    modelId: "fallback:strict-json-validation",
    output: input.output,
    promptVersion: input.promptVersion,
    repaired: true,
    usage: {
      costUsd: 0,
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
    validationError: input.validationError,
  }
}

async function persistAgentOutput<T>(
  deps: LiveAgentLoopDeps,
  investigationId: string,
  roundNumber: number,
  phase: Phase,
  agentRole: AgentRole,
  result: LiveAgentResult<T>,
  inputSnapshot: JsonValue,
): Promise<void> {
  await deps.investigations.appendLlmCall({
    investigationId,
    agentRole,
    modelAlias: result.modelAlias,
    model: result.modelId,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    costUsd: result.usage.costUsd,
    durationMs: result.usage.durationMs,
  })
  await deps.investigations.upsertAgentOutput({
    investigationId,
    roundNumber,
    phase,
    agentRole,
    stepKey: agentOutputStepKey(roundNumber, agentRole),
    modelAlias: result.modelAlias,
    modelId: result.modelId,
    promptVersion: result.promptVersion,
    inputSnapshot,
    outputJson: result.output as JsonValue,
    validationError: result.validationError,
  })
}

function agentOutputStepKey(roundNumber: number, agentRole: AgentRole): string {
  if (agentRole === "reporter") {
    return reporterStepKey()
  }

  if (agentRole === traceExpert) {
    return expertStepKey(roundNumber, traceExpert)
  }

  return roundStepKey(roundNumber, agentRole)
}

async function transitionPhase(
  investigationId: string,
  from: Phase,
  to: Phase,
  roundNumber: number,
  deps: LiveAgentLoopDeps,
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
      reason: "live phase machine transition",
      roundNumber,
      to,
    },
  })
}

function firstFinding(output: ExpertOutput, fallbackToolCallId: string) {
  const finding = output.findings[0]
  if (finding) {
    return {
      ...finding,
      cited_tool_calls: finding.cited_tool_calls.length
        ? finding.cited_tool_calls
        : [fallbackToolCallId],
    }
  }

  return {
    cited_tool_calls: [fallbackToolCallId],
    confidence_note: "No expert finding was returned.",
    text: "Trace evidence did not produce a concrete finding.",
  }
}

function firstReviewedFinding(
  output: CriticOutput,
  fallbackText: string,
  fallbackToolCallId: string,
) {
  return (
    output.reviewed_findings[0] ?? {
      cited_tool_calls: [fallbackToolCallId],
      credibility: 0.2,
      credibility_band: "speculative" as const,
      critic_notes: "Critic returned no reviewed findings.",
      expert_name: traceExpert,
      finding_text: fallbackText,
    }
  )
}

type EvidenceResult = {
  configured: boolean
  gapType?: "not_configured" | "query_failed" | "result_too_large" | "zero_results"
  kind: "code" | "deploy" | "feature_flag" | "log" | "metric" | "trace"
  query: JsonValue
  status: "empty" | "error" | "ok" | "skipped" | "too_large"
  data?: JsonValue
  error?: string
}

async function collectLiveEvidence(
  backends: ArgusBackendRegistry | undefined,
  incidentId: string,
  question: string,
  triggerPayload: JsonValue,
): Promise<JsonValue> {
  const serviceName =
    readString(triggerPayload, "serviceName") ?? readString(triggerPayload, "service") ?? "checkout"
  const start = readString(triggerPayload, "start")
  const end = readString(triggerPayload, "end")
  const environment = readString(triggerPayload, "environment") ?? "prod"
  const branch = readString(triggerPayload, "branch")
  const commitSha = readString(triggerPayload, "commitSha")
  const deployRef = readString(triggerPayload, "deployRef")
  const directDeployLog =
    readString(triggerPayload, "deployLog") ?? readString(triggerPayload, "buildLog")
  const codePattern = readString(triggerPayload, "codePattern") ?? serviceName
  const codePath =
    readString(triggerPayload, "codePath") ??
    readString(triggerPayload, "filePath") ??
    readString(triggerPayload, "path")
  const logQuery = readString(triggerPayload, "logQuery") ?? `{service="${serviceName}"}`
  const metricQuery =
    readString(triggerPayload, "metricQuery") ??
    `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="${serviceName}"}[5m])) by (le))`
  const results = await Promise.all([
    collectEvidence(
      "trace",
      Boolean(backends?.traces),
      {
        limit: 20,
        serviceName,
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
      },
      async () => {
        if (!backends?.traces) {
          return fallbackTraceEvidence(incidentId, serviceName)
        }

        return backends.traces.searchTraces({
          limit: 20,
          serviceName,
          ...(start ? { start } : {}),
          ...(end ? { end } : {}),
        })
      },
    ),
    collectEvidence(
      "log",
      Boolean(backends?.logs),
      {
        direction: "backward",
        limit: 100,
        query: logQuery,
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
      },
      async () => {
        if (!backends?.logs) {
          return skippedEvidence("configure Loki for live log evidence")
        }

        return backends.logs.queryLogs({
          direction: "backward",
          limit: 100,
          query: logQuery,
          ...(start ? { start } : {}),
          ...(end ? { end } : {}),
        })
      },
    ),
    collectEvidence(
      "metric",
      Boolean(backends?.metrics),
      {
        query: metricQuery,
        step: "30s",
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
      },
      async () => {
        if (!backends?.metrics) {
          return skippedEvidence("configure Prometheus for live metric evidence")
        }

        return backends.metrics.queryMetrics({
          query: metricQuery,
          step: "30s",
          ...(start ? { start } : {}),
          ...(end ? { end } : {}),
        })
      },
    ),
    collectEvidence(
      "deploy",
      Boolean(directDeployLog ?? backends?.githubActions ?? backends?.deploys),
      {
        ...(commitSha ? { commitSha } : {}),
        ...(deployRef ? { deployRef } : {}),
        environment,
        serviceName,
        ...(branch ? { branch } : {}),
        ...(start ? { since: start } : {}),
        ...(end ? { until: end } : {}),
      },
      async () => {
        if (directDeployLog) {
          return directDeployLogEvidence({
            deployLog: directDeployLog,
            environment,
            incidentId,
            serviceName,
            ...(commitSha ? { commitSha } : {}),
            ...(deployRef ? { deployRef } : {}),
          })
        }

        if (backends?.githubActions) {
          return backends.githubActions.listWorkflowRuns({
            ...(branch ? { branch } : {}),
            perPage: 20,
            status: "completed",
          })
        }

        if (backends?.deploys) {
          return backends.deploys.listDeploys({
            environment,
            serviceName,
            ...(start ? { since: start } : {}),
            ...(end ? { until: end } : {}),
          })
        }

        return skippedEvidence("configure GitHub Actions for live deploy evidence")
      },
    ),
    collectEvidence(
      "code",
      Boolean(backends?.code),
      {
        ...(commitSha ? { commitSha } : {}),
        ...(codePath ? { path: codePath } : {}),
        maxMatches: 10,
        pattern: codePattern,
      },
      async () => {
        if (!backends?.code) {
          return skippedEvidence("connect GitHub code search or local git for live code evidence")
        }

        return backends.code.searchCode({
          ...(commitSha ? { commitSha } : {}),
          ...(codePath ? { path: codePath } : {}),
          maxMatches: 10,
          pattern: codePattern,
        })
      },
    ),
    collectEvidence(
      "feature_flag",
      false,
      {
        provider: "launchdarkly",
        serviceName,
      },
      async () => skippedEvidence("LaunchDarkly flag adapter is documented as a v1 cut"),
    ),
  ])

  return {
    evidence: "normalized live evidence bundle",
    incidentId,
    question,
    results,
    serviceName,
    timeWindow: {
      end: end ?? null,
      start: start ?? null,
    },
  }
}

async function collectEvidence(
  kind: EvidenceResult["kind"],
  configured: boolean,
  query: JsonValue,
  execute: () => Promise<JsonValue>,
): Promise<EvidenceResult> {
  try {
    const data = await execute()
    if (!configured) {
      return {
        configured,
        data,
        gapType: "not_configured",
        kind,
        query,
        status: "skipped",
      }
    }

    if (isEmptyEvidence(data)) {
      return {
        configured,
        data,
        gapType: "zero_results",
        kind,
        query,
        status: "empty",
      }
    }

    return {
      configured,
      data,
      kind,
      query,
      status: "ok",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    const tooLarge = message.includes("result exceeded")

    return {
      configured,
      error: `${kind} evidence unavailable: ${message}`,
      gapType: tooLarge ? "result_too_large" : "query_failed",
      kind,
      query,
      status: tooLarge ? "too_large" : "error",
    }
  }
}

function collectToolErrors(evidence: JsonValue): string[] {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return []
  }

  const results = evidence.results
  if (!Array.isArray(results)) {
    return []
  }

  return results.flatMap((result) => {
    if (
      result &&
      typeof result === "object" &&
      !Array.isArray(result) &&
      (result.status === "error" || result.status === "too_large") &&
      typeof result.error === "string"
    ) {
      return [result.error]
    }

    return []
  })
}

function directDeployLogEvidence(input: {
  commitSha?: string
  deployLog: string
  deployRef?: string
  environment: string
  incidentId: string
  serviceName: string
}): JsonValue {
  return {
    commitSha: input.commitSha ?? null,
    deployRef: input.deployRef ?? null,
    environment: input.environment,
    incidentId: input.incidentId,
    logExcerpt: truncateText(input.deployLog, 12_000),
    logLength: input.deployLog.length,
    serviceName: input.serviceName,
    source: "provided_deploy_log",
    truncated: input.deployLog.length > 12_000,
  }
}

function fallbackTraceEvidence(incidentId: string, serviceName: string): JsonValue {
  return {
    baselineP95Ms: 240,
    dominantSpan: "payment_authorize",
    evidence: "local fallback trace summary; configure Tempo for live trace data",
    incidentId,
    operation: `POST /${serviceName}`,
    p95Ms: 1840,
    service: serviceName,
  }
}

function skippedEvidence(reason: string): JsonValue {
  return { reason }
}

function isEmptyEvidence(value: JsonValue): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const containers = [
    value,
    "result" in value &&
    value.result &&
    typeof value.result === "object" &&
    !Array.isArray(value.result)
      ? value.result
      : null,
    "data" in value && value.data && typeof value.data === "object" && !Array.isArray(value.data)
      ? value.data
      : null,
  ].filter((container): container is Record<string, JsonValue> => Boolean(container))

  return containers.some((container) =>
    [
      "deployments",
      "items",
      "matches",
      "result",
      "series",
      "streams",
      "traces",
      "workflow_runs",
    ].some((key) => Array.isArray(container[key]) && container[key].length === 0),
  )
}

function readString(value: JsonValue, key: string): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }

  const candidate = value[key]
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate : undefined
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`
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

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}
