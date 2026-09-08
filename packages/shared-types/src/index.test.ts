import { describe, expect, it } from "vitest"

import {
  directorActionSchema,
  expertOutputSchema,
  investigationSummarySchema,
  reporterOutputSchema,
} from "./index.js"

const id = "00000000-0000-4000-8000-000000000000"

describe("shared schemas", () => {
  it("validates an investigation summary", () => {
    const result = investigationSummarySchema.safeParse({
      id,
      incidentId: "incident-1",
      status: "running",
      currentPhase: "triage",
      currentRound: 0,
      confidence: null,
      totalCostUsd: null,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    })

    expect(result.success).toBe(true)
  })

  it("rejects Director actions that try to set final confidence", () => {
    const result = directorActionSchema.safeParse({
      type: "declare_verdict",
      hypothesis: "checkout latency came from a slow dependency",
      confidence: 0.9,
    })

    expect(result.success).toBe(false)
  })

  it("requires Expert findings to cite tool calls", () => {
    const result = expertOutputSchema.safeParse({
      findings: [{ text: "The trace shows checkout latency.", cited_tool_calls: [] }],
    })

    expect(result.success).toBe(false)
  })

  it("validates Reporter output with an evidence chain", () => {
    const result = reporterOutputSchema.safeParse({
      verdict: "Checkout latency was caused by the payment service.",
      confidence: 0.72,
      timeline: [
        { timestamp: "2026-05-23T00:00:00.000Z", text: "Latency rose.", source_ids: [id] },
      ],
      evidence_chain: [
        {
          claim: "Payment service latency rose first.",
          sourceType: "tool_call",
          sourceId: id,
          relevance: "direct",
        },
      ],
      dissent_considered: "Counsel raised no unresolved high-strength dissent.",
      recommended_fix: {
        immediate: "Rollback payment service deploy.",
        long_term: "Add payment dependency SLO alerts.",
      },
    })

    expect(result.success).toBe(true)
  })
})
