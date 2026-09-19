import type { LlmGateway } from "@argus/llm-gateway"
import { describe, expect, it } from "vitest"

import { createLiveAgentRunner } from "./index.js"

const modelAliases = {
  "director.primary": "director-model",
  "expert.cheap": "expert-model",
  "critic.balanced": "critic-model",
  "counsel.balanced": "counsel-model",
  "reporter.primary": "reporter-model",
}

describe("createLiveAgentRunner", () => {
  it("uses model aliases and returns validated agent output metadata", async () => {
    const requests: unknown[] = []
    const gateway: LlmGateway = {
      async generateStrictJson(request) {
        requests.push(request)
        return {
          modelId: request.modelId,
          output: {
            type: "dispatch_experts",
            experts: [{ name: "trace_expert", questions: ["Inspect trace evidence."] }],
          },
          rawText: "{}",
          repaired: false,
          usage: {
            costUsd: 0.001,
            durationMs: 25,
            inputTokens: 100,
            outputTokens: 40,
          },
          validationError: null,
        }
      },
    }

    const runner = createLiveAgentRunner({ gateway, modelAliases })
    const result = await runner.runDirector({
      currentPhase: "triage",
      currentRound: 0,
      incidentId: "checkout-latency",
      triggerPayload: { summary: "latency spike" },
    })

    expect(result.modelAlias).toBe("director.primary")
    expect(result.modelId).toBe("director-model")
    expect(result.promptVersion).toBe("director.live.v1")
    expect(result.usage.inputTokens).toBe(100)
    expect(requests).toHaveLength(1)
  })

  it("prompts Reporter with exact strict schema field names", async () => {
    const requests: Array<{ prompt: string; maxTokens?: number }> = []
    const gateway: LlmGateway = {
      async generateStrictJson(request) {
        requests.push({ prompt: request.prompt, maxTokens: request.maxTokens })
        return {
          modelId: request.modelId,
          output: {
            verdict: "Synthetic evidence is insufficient for a confirmed root cause.",
            confidence: 0.42,
            timeline: [
              {
                timestamp: "2026-05-24T06:40:41.133Z",
                text: "Smoke investigation started.",
                source_ids: ["33333333-3333-4333-8333-333333333333"],
              },
            ],
            evidence_chain: [
              {
                claim: "Trace evidence was inspected.",
                sourceType: "tool_call",
                sourceId: "11111111-1111-4111-8111-111111111111",
                relevance: "direct",
              },
            ],
            dissent_considered: "Counsel dissent was considered.",
            recommended_fix: {
              immediate: "Configure live telemetry.",
              long_term: "Add production observability integrations.",
            },
          },
          rawText: "{}",
          repaired: false,
          usage: {
            costUsd: 0.001,
            durationMs: 25,
            inputTokens: 100,
            outputTokens: 40,
          },
          validationError: null,
        }
      },
    }

    const runner = createLiveAgentRunner({ gateway, modelAliases })
    await runner.runReporter({
      confidence: 0.42,
      dissentEntryIds: ["44444444-4444-4444-8444-444444444444"],
      incidentId: "checkout-latency",
      reviewFindingId: "22222222-2222-4222-8222-222222222222",
      timelineEventId: "33333333-3333-4333-8333-333333333333",
      timelineText: "Smoke investigation started.",
      timelineTimestamp: "2026-05-24T06:40:41.133Z",
      toolCallId: "11111111-1111-4111-8111-111111111111",
    })

    expect(requests[0]?.maxTokens).toBe(2400)
    expect(requests[0]?.prompt).toContain('"sourceType": "tool_call"')
    expect(requests[0]?.prompt).toContain("sourceType and sourceId")
    expect(requests[0]?.prompt).toContain("not source_type or source_id")
  })

  it("prompts Counsel with exact evidence citation objects", async () => {
    const requests: Array<{ prompt: string; maxTokens?: number }> = []
    const gateway: LlmGateway = {
      async generateStrictJson(request) {
        requests.push({ prompt: request.prompt, maxTokens: request.maxTokens })
        return {
          modelId: request.modelId,
          output: {
            dissent_entries: [
              {
                counter_argument: "Live evidence is missing.",
                dissent_strength: 0.8,
                evidence_cited: [
                  {
                    source_type: "evidence_gap",
                    description: "Tempo is not configured.",
                  },
                  {
                    source_type: "review_finding",
                    source_id: "22222222-2222-4222-8222-222222222222",
                    description: "The review finding is speculative.",
                  },
                ],
              },
            ],
          },
          rawText: "{}",
          repaired: false,
          usage: {
            costUsd: 0.001,
            durationMs: 25,
            inputTokens: 100,
            outputTokens: 40,
          },
          validationError: null,
        }
      },
    }

    const runner = createLiveAgentRunner({ gateway, modelAliases })
    await runner.runCounsel({
      evidenceGaps: ["Tempo is not configured."],
      reviewFindingId: "22222222-2222-4222-8222-222222222222",
      timelineEventId: "33333333-3333-4333-8333-333333333333",
    })

    expect(requests[0]?.maxTokens).toBe(1400)
    expect(requests[0]?.prompt).toContain("evidence_cited must be an array of objects")
    expect(requests[0]?.prompt).toContain('"source_type": "evidence_gap"')
    expect(requests[0]?.prompt).toContain('"source_type": "review_finding"')
  })
})
