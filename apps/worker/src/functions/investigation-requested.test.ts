import type { LiveAgentRunner } from "@argus/agents"
import { StrictJsonGenerationError } from "@argus/llm-gateway"
import type { InvestigationSummary, JsonValue } from "@argus/shared-types"
import { describe, expect, it } from "vitest"

import { type InvestigationRequestedEvent, investigationRequestedEventName } from "../events.js"
import {
  type InvestigationRequestedWorkflowDeps,
  handleInvestigationRequested,
} from "./investigation-requested.js"

const investigationId = "11111111-1111-4111-8111-111111111111"
const event: InvestigationRequestedEvent = createEvent()

const modelAliases = {
  "director.primary": "director-model",
  "expert.cheap": "expert-model",
  "critic.balanced": "critic-model",
  "counsel.balanced": "counsel-model",
  "reporter.primary": "reporter-model",
}

describe("investigation requested workflow", () => {
  it("runs TRIAGE -> TRACE -> VERDICT and completes the investigation", async () => {
    const appendedEvents: unknown[] = []
    const agentOutputs: unknown[] = []
    const dissentEntries: unknown[] = []
    const toolCalls: unknown[] = []
    const deps = createDeps({
      appendedEvents,
      agentOutputs,
      dissentEntries,
      toolCalls,
    })

    await expect(handleInvestigationRequested(event, deps)).resolves.toEqual({
      investigationId,
      incidentId: "checkout-latency-2026-05-23",
      currentPhase: "triage",
      nextPhase: "done",
      currentRound: 0,
      eventSequence: 13,
      confidence: 0.68,
      status: "completed",
    })

    expect(toolCalls).toHaveLength(2)
    expect(agentOutputs).toHaveLength(9)
    expect(dissentEntries).toHaveLength(1)
    expect(appendedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "agent_started" }),
        expect.objectContaining({ eventType: "agent_completed" }),
        expect.objectContaining({
          eventType: "phase_changed",
          payload: expect.objectContaining({ from: "triage", to: "trace" }),
        }),
        expect.objectContaining({ eventType: "tool_started" }),
        expect.objectContaining({ eventType: "tool_completed" }),
        expect.objectContaining({
          eventType: "phase_changed",
          payload: expect.objectContaining({ from: "trace", to: "verdict" }),
        }),
        expect.objectContaining({ eventType: "artifact_written" }),
      ]),
    )
  })

  it("uses live agents when an agent runner is provided", async () => {
    const agentOutputs: unknown[] = []
    const llmCalls: unknown[] = []
    const toolCalls: unknown[] = []
    const deps = createDeps({
      agentOutputs,
      agents: createFakeLiveAgents(),
      llmCalls,
      toolCalls,
    })

    await expect(handleInvestigationRequested(event, deps)).resolves.toMatchObject({
      confidence: 0.86,
      status: "completed",
    })

    expect(agentOutputs).toHaveLength(5)
    expect(llmCalls).toHaveLength(5)
    expect(toolCalls).toEqual([
      expect.objectContaining({
        error: null,
        result: expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({ kind: "trace", status: "skipped" }),
            expect.objectContaining({ kind: "log", status: "skipped" }),
            expect.objectContaining({ kind: "metric", status: "skipped" }),
            expect.objectContaining({ kind: "deploy", status: "skipped" }),
            expect.objectContaining({ kind: "code", status: "skipped" }),
            expect.objectContaining({ kind: "feature_flag", status: "skipped" }),
          ]),
        }),
        toolName: "evidence.bundle",
      }),
    ])
  })

  it("uses conservative fallback output when live agent JSON validation fails", async () => {
    const agentOutputs: unknown[] = []
    const deps = createDeps({
      agentOutputs,
      agents: createFakeLiveAgents({ failTraceExpert: true }),
    })

    await expect(handleInvestigationRequested(event, deps)).resolves.toMatchObject({
      status: "completed",
    })

    expect(agentOutputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentRole: "trace_expert",
          modelId: "fallback:strict-json-validation",
          promptVersion: "trace-expert.live.fallback.v1",
          validationError: "trace expert schema mismatch",
        }),
      ]),
    )
  })

  it("passes configured live tool results to live agents", async () => {
    const toolResults: JsonValue[] = []
    const deps = createDeps({
      agents: createFakeLiveAgents({ toolResults }),
      backends: {
        logs: {
          async queryLogs() {
            return { streams: [{ line: "checkout timeout" }] }
          },
        },
        metrics: {
          async queryMetrics() {
            return { series: [{ p95: 1.84 }] }
          },
        },
        traces: {
          async searchTraces() {
            return { traces: [{ traceId: "trace-1" }] }
          },
        },
      },
    })

    await handleInvestigationRequested(event, deps)

    expect(toolResults[0]).toEqual(
      expect.objectContaining({
        results: expect.arrayContaining([
          expect.objectContaining({
            data: { traces: [{ traceId: "trace-1" }] },
            kind: "trace",
            status: "ok",
          }),
          expect.objectContaining({
            data: { streams: [{ line: "checkout timeout" }] },
            kind: "log",
            status: "ok",
          }),
          expect.objectContaining({
            data: { series: [{ p95: 1.84 }] },
            kind: "metric",
            status: "ok",
          }),
        ]),
      }),
    )
  })

  it("persists direct deploy log text as cited live evidence", async () => {
    const toolResults: JsonValue[] = []
    const deps = createDeps({
      agents: createFakeLiveAgents({ toolResults }),
    })

    await handleInvestigationRequested(
      createEvent({
        buildLog:
          "Failed to compile. Module not found: Can't resolve '@argus/shared-types' in app/api/investigations/route.ts",
        codePattern: "@argus/shared-types",
        commitSha: "bbdf4a6",
        serviceName: "argus-dashboard",
      }),
      deps,
    )

    expect(toolResults[0]).toEqual(
      expect.objectContaining({
        results: expect.arrayContaining([
          expect.objectContaining({
            configured: true,
            data: expect.objectContaining({
              commitSha: "bbdf4a6",
              logExcerpt: expect.stringContaining("Module not found"),
              source: "provided_deploy_log",
            }),
            kind: "deploy",
            status: "ok",
          }),
          expect.objectContaining({
            gapType: "not_configured",
            kind: "code",
            query: expect.objectContaining({
              commitSha: "bbdf4a6",
              maxMatches: 10,
              pattern: "@argus/shared-types",
            }),
            status: "skipped",
          }),
        ]),
      }),
    )
  })

  it("classifies zero-result and oversized live evidence separately", async () => {
    const toolResults: JsonValue[] = []
    const deps = createDeps({
      agents: createFakeLiveAgents({ toolResults }),
      backends: {
        code: {
          async searchCode() {
            throw new Error("github code search result exceeded 65536 bytes")
          },
        },
        githubActions: {
          async listWorkflowRuns() {
            return { workflow_runs: [] }
          },
        },
      },
    })

    await handleInvestigationRequested(
      createEvent({
        branch: "master",
        codePattern: "@argus/shared-types",
        serviceName: "argus-dashboard",
      }),
      deps,
    )

    expect(toolResults[0]).toEqual(
      expect.objectContaining({
        results: expect.arrayContaining([
          expect.objectContaining({
            gapType: "zero_results",
            kind: "deploy",
            status: "empty",
          }),
          expect.objectContaining({
            error: expect.stringContaining("result exceeded"),
            gapType: "result_too_large",
            kind: "code",
            status: "too_large",
          }),
        ]),
      }),
    )
  })

  it("turns live tool failures into evidence gaps instead of failing the workflow", async () => {
    const counselGaps: string[][] = []
    const toolCalls: unknown[] = []
    const deps = createDeps({
      agents: createFakeLiveAgents({ counselGaps }),
      backends: {
        traces: {
          async searchTraces() {
            throw new Error("tempo unavailable")
          },
        },
      },
      toolCalls,
    })

    await expect(handleInvestigationRequested(event, deps)).resolves.toMatchObject({
      status: "completed",
    })

    expect(toolCalls).toEqual([
      expect.objectContaining({
        error: expect.stringContaining("trace evidence unavailable: tempo unavailable"),
      }),
    ])
    expect(counselGaps[0]).toEqual(["trace evidence unavailable: tempo unavailable"])
  })

  it("can run multiple Director rounds before verdict", async () => {
    const toolCalls: unknown[] = []
    const phases: string[] = []
    const deps = createDeps({
      orderedWrites: phases,
      toolCalls,
    })

    await handleInvestigationRequested(
      createEvent({
        rounds: 2,
        service: "checkout",
        summary: "checkout p95 latency spike",
      }),
      deps,
    )

    expect(toolCalls).toHaveLength(2)
    expect(phases).toContain("advance:trace:r0")
    expect(phases).toContain("advance:triage:r1")
    expect(phases).toContain("advance:verdict:r1")
  })

  it("persists tool calls before Expert findings cite them", async () => {
    const orderedWrites: string[] = []
    const deps = createDeps({ orderedWrites })

    await handleInvestigationRequested(event, deps)

    expect(orderedWrites).toEqual([
      "event:agent_started",
      "journal",
      "agent:director",
      "event:agent_completed",
      "advance:trace:r0",
      "event:phase_changed",
      "event:tool_started",
      "tool:r0-expert-trace_expert",
      "event:tool_completed",
      "agent:trace_expert",
      "review",
      "timeline",
      "agent:critic",
      "agent:counsel",
      "dissent",
      "metadata",
      "journal",
      "advance:triage:r1",
      "event:phase_changed",
      "event:agent_started",
      "journal",
      "agent:director",
      "event:agent_completed",
      "advance:trace:r1",
      "event:phase_changed",
      "event:tool_started",
      "tool:r1-expert-trace_expert",
      "event:tool_completed",
      "agent:trace_expert",
      "review",
      "timeline",
      "agent:critic",
      "agent:counsel",
      "metadata",
      "advance:verdict:r1",
      "event:phase_changed",
      "agent:reporter",
      "complete",
      "event:artifact_written",
    ])
  })

  it("persists evidence gaps into timeline metadata", async () => {
    const metadataWrites: unknown[] = []
    const deps = createDeps({ metadataWrites })

    await handleInvestigationRequested(event, deps)

    expect(metadataWrites).toEqual([
      {
        investigationId,
        confidenceScore: 0.86,
        evidenceGaps: [
          "Deploy and flag evidence are not yet inspected in the Phase 5 mocked loop.",
        ],
      },
      {
        investigationId,
        confidenceScore: 0.86,
        evidenceGaps: [],
      },
    ])
  })

  it("persists Counsel dissent with evidence citations and lowers confidence", async () => {
    const dissentEntries: unknown[] = []
    const deps = createDeps({ dissentEntries })

    await expect(handleInvestigationRequested(event, deps)).resolves.toMatchObject({
      confidence: 0.68,
      status: "completed",
    })

    expect(dissentEntries).toEqual([
      expect.objectContaining({
        counterArgument: expect.stringContaining("deploy and flag evidence"),
        dissentStrength: 0.45,
        directorResponse: expect.stringContaining("another TRACE round"),
        evidenceCited: expect.arrayContaining([
          expect.objectContaining({
            source_type: "evidence_gap",
          }),
          expect.objectContaining({
            source_type: "review_finding",
          }),
        ]),
        resolved: false,
      }),
    ])
  })

  it("marks the investigation failed when the phase machine fails after loading state", async () => {
    const orderedWrites: string[] = []
    const deps = createDeps({
      backends: {
        traces: {
          async searchTraces() {
            throw new Error("tempo unavailable")
          },
        },
      },
      orderedWrites,
    })

    await expect(handleInvestigationRequested(event, deps)).resolves.toMatchObject({
      confidence: null,
      status: "failed",
    })
    expect(orderedWrites).toContain("fail")
    expect(orderedWrites).toContain("event:error")
  })

  it("can cancel an investigation before running agents", async () => {
    const orderedWrites: string[] = []
    const deps = createDeps({ orderedWrites })

    await expect(
      handleInvestigationRequested(createEvent({ cancel: true }), deps),
    ).resolves.toEqual({
      investigationId,
      incidentId: "checkout-latency-2026-05-23",
      currentPhase: "triage",
      nextPhase: "done",
      currentRound: 0,
      eventSequence: 1,
      confidence: null,
      status: "cancelled",
    })
    expect(orderedWrites).toEqual(["cancel", "event:phase_changed"])
  })

  it("treats completed investigation retries as idempotent no-ops", async () => {
    const orderedWrites: string[] = []
    const deps = createDeps({
      investigation: createInvestigation({
        confidence: 0.86,
        currentPhase: "done",
        status: "completed",
      }),
      orderedWrites,
    })

    await expect(handleInvestigationRequested(event, deps)).resolves.toEqual({
      investigationId,
      incidentId: "checkout-latency-2026-05-23",
      currentPhase: "done",
      nextPhase: "done",
      currentRound: 0,
      eventSequence: 0,
      confidence: 0.86,
      status: "completed",
    })
    expect(orderedWrites).toEqual([])
  })

  it("treats failed investigation retries as idempotent no-ops", async () => {
    const orderedWrites: string[] = []
    const deps = createDeps({
      investigation: createInvestigation({
        currentPhase: "done",
        status: "failed",
      }),
      orderedWrites,
    })

    await expect(handleInvestigationRequested(event, deps)).resolves.toMatchObject({
      eventSequence: 0,
      status: "failed",
    })
    expect(orderedWrites).toEqual([])
  })

  it("fails when the investigation row is missing", async () => {
    const deps = createDeps({
      investigation: null,
    })

    await expect(handleInvestigationRequested(event, deps)).rejects.toThrow(
      "investigation not found",
    )
  })

  it("enforces the max round limit before appending events", async () => {
    const appendedEvents: unknown[] = []
    const deps = createDeps({
      appendedEvents,
      investigation: createInvestigation({
        currentPhase: "trace",
        currentRound: 20,
      }),
    })

    await expect(handleInvestigationRequested(event, deps)).rejects.toThrow("round limit exceeded")
    expect(appendedEvents).toEqual([])
  })

  it("stops already-cancelled investigations before appending events", async () => {
    const appendedEvents: unknown[] = []
    const deps = createDeps({
      appendedEvents,
      investigation: createInvestigation({
        status: "cancelled",
        currentPhase: "trace",
        currentRound: 1,
      }),
    })

    await expect(handleInvestigationRequested(event, deps)).rejects.toThrow(
      "investigation cancelled",
    )
    expect(appendedEvents).toEqual([])
  })
})

type CreateDepsOptions = {
  agentOutputs?: unknown[]
  agents?: LiveAgentRunner
  appendedEvents?: unknown[]
  backends?: InvestigationRequestedWorkflowDeps["backends"]
  dissentEntries?: unknown[]
  investigation?: InvestigationSummary | null
  metadataWrites?: unknown[]
  llmCalls?: unknown[]
  orderedWrites?: string[]
  toolCalls?: unknown[]
}

function createDeps(options: CreateDepsOptions = {}): InvestigationRequestedWorkflowDeps {
  const investigation = "investigation" in options ? options.investigation : createInvestigation()
  const appendedEvents = options.appendedEvents ?? []
  const agentOutputs = options.agentOutputs ?? []
  const dissentEntries = options.dissentEntries ?? []
  const metadataWrites = options.metadataWrites ?? []
  const llmCalls = options.llmCalls ?? []
  const toolCalls = options.toolCalls ?? []
  const orderedWrites = options.orderedWrites

  return {
    agents: options.agents,
    backends: options.backends,
    modelAliases,
    investigations: {
      async advancePhase(input) {
        orderedWrites?.push(`advance:${input.phase}:r${input.roundNumber}`)
        return createInvestigation({
          currentPhase: input.phase,
          currentRound: input.roundNumber,
        })
      },
      async appendDissentEntry(input) {
        dissentEntries.push(input)
        orderedWrites?.push("dissent")

        return {
          id: "99999999-9999-4999-8999-999999999999",
          roundNumber: input.roundNumber,
          counterArgument: input.counterArgument,
          dissentStrength: input.dissentStrength,
          evidenceCited: input.evidenceCited,
          directorResponse: input.directorResponse ?? null,
          resolved: input.resolved ?? false,
          createdAt: "2026-05-23T00:00:00.000Z",
        }
      },
      async appendLlmCall() {
        llmCalls.push({})
        orderedWrites?.push("llm")
      },
      async appendEvent(input) {
        appendedEvents.push(input)
        orderedWrites?.push(`event:${input.eventType}`)

        return {
          id: "33333333-3333-4333-8333-333333333333",
          investigationId: input.investigationId,
          sequence: appendedEvents.length,
          eventType: input.eventType,
          payload: input.payload,
          createdAt: "2026-05-23T00:00:00.000Z",
        }
      },
      async appendJournalEntry(input) {
        orderedWrites?.push("journal")

        return {
          id: "77777777-7777-4777-8777-777777777777",
          roundNumber: input.roundNumber,
          phase: input.phase,
          entryType: input.entryType,
          content: input.content,
          priority: input.priority ?? null,
          citedToolCalls: input.citedToolCalls ?? [],
          citedFindings: input.citedFindings ?? [],
          createdAt: "2026-05-23T00:00:00.000Z",
        }
      },
      async appendReviewFinding(input) {
        orderedWrites?.push("review")

        return {
          id: `55555555-5555-4555-8555-55555555555${input.roundNumber}`,
          roundNumber: input.roundNumber,
          expertName: input.expertName,
          findingText: input.findingText,
          credibility: input.credibility,
          credibilityBand: input.credibilityBand,
          citedToolCalls: input.citedToolCalls,
          criticNotes: input.criticNotes,
          createdAt: "2026-05-23T00:00:00.000Z",
        }
      },
      async appendTimelineEvent(input) {
        orderedWrites?.push("timeline")

        return {
          id: `66666666-6666-4666-8666-66666666666${input.roundNumber}`,
          roundNumber: input.roundNumber,
          eventTimestamp: input.eventTimestamp.toISOString(),
          eventText: input.eventText,
          sourceFindings: input.sourceFindings,
        }
      },
      async cancelInvestigation() {
        orderedWrites?.push("cancel")
        return createInvestigation({
          currentPhase: "done",
          status: "cancelled",
        })
      },
      async completeInvestigation(input) {
        orderedWrites?.push("complete")

        return createInvestigation({
          id: input.id,
          status: "completed",
          currentPhase: "done",
          confidence: input.confidence,
        })
      },
      async failInvestigation() {
        orderedWrites?.push("fail")
        return createInvestigation({
          currentPhase: "done",
          status: "failed",
        })
      },
      async getById() {
        return investigation
      },
      async upsertAgentOutput(input) {
        agentOutputs.push(input)
        orderedWrites?.push(`agent:${input.agentRole}`)

        return {
          id: "88888888-8888-4888-8888-888888888888",
          ...input,
        }
      },
      async upsertTimelineMetadata(input) {
        metadataWrites.push(input)
        orderedWrites?.push("metadata")
      },
      async upsertToolCall(input) {
        toolCalls.push(input)
        orderedWrites?.push(`tool:${input.stepKey}`)

        return {
          id: `44444444-4444-4444-8444-44444444444${input.arguments && typeof input.arguments === "object" && !Array.isArray(input.arguments) && typeof input.arguments.roundNumber === "number" ? input.arguments.roundNumber : 0}`,
          ...input,
        }
      },
    },
  }
}

function createFakeLiveAgents(
  options: { counselGaps?: string[][]; failTraceExpert?: boolean; toolResults?: JsonValue[] } = {},
): LiveAgentRunner {
  const usage = {
    costUsd: 0.001,
    durationMs: 25,
    inputTokens: 100,
    outputTokens: 50,
  }

  return {
    async runCounsel(input) {
      options.counselGaps?.push(input.evidenceGaps)

      return {
        modelAlias: "counsel.balanced",
        modelId: "counsel-model",
        output: {
          dissent_entries: [],
        },
        promptVersion: "counsel.live.v1",
        repaired: false,
        usage,
        validationError: null,
      }
    },
    async runCritic() {
      return {
        modelAlias: "critic.balanced",
        modelId: "critic-model",
        output: {
          evidence_gaps: [],
          reviewed_findings: [
            {
              expert_name: "trace_expert",
              finding_text:
                "Checkout traces show p95 latency rose and payment_authorize dominated latency.",
              credibility: 0.86,
              credibility_band: "highly_plausible",
              cited_tool_calls: ["44444444-4444-4444-8444-444444444440"],
              critic_notes: "Tool call directly supports the finding.",
            },
          ],
          timeline_events: [
            {
              event_timestamp: "2026-05-23T00:00:00.000Z",
              event_text: "Checkout latency spiked in payment_authorize.",
              source_findings: ["55555555-5555-4555-8555-555555555550"],
            },
          ],
        },
        promptVersion: "critic.live.v1",
        repaired: false,
        usage,
        validationError: null,
      }
    },
    async runDirector() {
      return {
        modelAlias: "director.primary",
        modelId: "director-model",
        output: {
          type: "dispatch_experts",
          experts: [
            {
              name: "trace_expert",
              questions: ["Inspect checkout trace latency."],
            },
          ],
        },
        promptVersion: "director.live.v1",
        repaired: false,
        usage,
        validationError: null,
      }
    },
    async runReporter() {
      return {
        modelAlias: "reporter.primary",
        modelId: "reporter-model",
        output: {
          verdict:
            "Incident checkout-latency-2026-05-23 is caused by checkout latency in payment_authorize spans.",
          confidence: 0.86,
          timeline: [
            {
              timestamp: "2026-05-23T00:00:00.000Z",
              text: "Checkout latency spiked in payment_authorize.",
              source_ids: ["55555555-5555-4555-8555-555555555550"],
            },
          ],
          evidence_chain: [
            {
              claim: "Checkout latency increased.",
              sourceType: "tool_call",
              sourceId: "44444444-4444-4444-8444-444444444440",
              relevance: "direct",
            },
          ],
          dissent_considered: "Counsel found no unresolved dissent.",
          recommended_fix: {
            immediate: "Inspect payment_authorize.",
            long_term: "Add trace regression checks.",
          },
        },
        promptVersion: "reporter.live.v1",
        repaired: false,
        usage,
        validationError: null,
      }
    },
    async runTraceExpert(input) {
      options.toolResults?.push(input.toolResult)

      if (options.failTraceExpert) {
        throw new StrictJsonGenerationError(
          "LLM response failed strict JSON validation after repair retry",
          "trace expert schema mismatch",
        )
      }

      return {
        modelAlias: "expert.cheap",
        modelId: "expert-model",
        output: {
          findings: [
            {
              text: "Checkout traces show p95 latency rose and payment_authorize dominated latency.",
              cited_tool_calls: ["44444444-4444-4444-8444-444444444440"],
              confidence_note: "Trace result directly supports this.",
            },
          ],
        },
        promptVersion: "trace-expert.live.v1",
        repaired: false,
        usage,
        validationError: null,
      }
    },
  }
}

function createEvent(
  triggerPayload: JsonValue = defaultTriggerPayload(),
): InvestigationRequestedEvent {
  return {
    name: investigationRequestedEventName,
    data: {
      investigationId,
      incidentId: "checkout-latency-2026-05-23",
      triggerPayload,
    },
  }
}

function defaultTriggerPayload(): JsonValue {
  return {
    service: "checkout",
    summary: "checkout p95 latency spike",
  }
}

function createInvestigation(overrides: Partial<InvestigationSummary> = {}): InvestigationSummary {
  return {
    id: investigationId,
    incidentId: "checkout-latency-2026-05-23",
    status: "running",
    currentPhase: "triage",
    currentRound: 0,
    confidence: null,
    totalCostUsd: null,
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
    ...overrides,
  }
}
