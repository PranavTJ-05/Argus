import type { EvalDataset } from "../index.js"

const toolCallId = "11111111-1111-4111-8111-111111111111"
const reviewFindingId = "22222222-2222-4222-8222-222222222222"
const timelineEventId = "33333333-3333-4333-8333-333333333333"
const dissentEntryId = "44444444-4444-4444-8444-444444444444"

export const smokeDataset: EvalDataset = [
  {
    id: "checkout-latency-smoke",
    incidentId: "checkout-latency-2026-05-23",
    description: "Checkout p95 latency spike dominated by payment_authorize spans.",
    expectedRootCauseTerms: ["checkout latency", "payment_authorize"],
    expectedEvidenceSourceTypes: ["tool_call", "review_finding", "timeline_event", "dissent_entry"],
    expectedCounselCatch: true,
    expectedConfidence: 0.68,
    costUsd: 0.024,
    latencyMs: 1840,
    actualReport: {
      verdict:
        "Incident checkout-latency-2026-05-23 is most likely caused by elevated checkout latency in payment_authorize spans.",
      confidence: 0.68,
      timeline: [
        {
          timestamp: "2026-05-23T00:00:00.000Z",
          text: "Checkout p95 latency spiked and was dominated by payment_authorize spans.",
          source_ids: [reviewFindingId],
        },
      ],
      evidence_chain: [
        {
          claim: "Checkout latency increased sharply during the incident.",
          sourceType: "tool_call",
          sourceId: toolCallId,
          relevance: "direct",
        },
        {
          claim: "The Critic found the trace finding highly plausible.",
          sourceType: "review_finding",
          sourceId: reviewFindingId,
          relevance: "supporting",
        },
        {
          claim: "The incident timeline includes the confirmed checkout latency spike.",
          sourceType: "timeline_event",
          sourceId: timelineEventId,
          relevance: "context",
        },
        {
          claim: "Counsel objected that missing deploy evidence may weaken the verdict.",
          sourceType: "dissent_entry",
          sourceId: dissentEntryId,
          relevance: "contradicting",
        },
      ],
      dissent_considered:
        "Counsel raised unresolved dissent with strength 0.45; confidence was reduced and an extra TRACE round was run.",
      recommended_fix: {
        immediate: "Inspect the payment_authorize dependency and reduce checkout traffic pressure.",
        long_term: "Add trace-backed regression checks for checkout payment_authorize latency.",
      },
    },
    baselineReport: {
      verdict: "Incident checkout-latency-2026-05-23 is likely a checkout issue.",
      confidence: 0.91,
      timeline: [
        {
          timestamp: "2026-05-23T00:00:00.000Z",
          text: "Checkout latency increased.",
          source_ids: [reviewFindingId],
        },
      ],
      evidence_chain: [
        {
          claim: "Checkout latency increased.",
          sourceType: "review_finding",
          sourceId: reviewFindingId,
          relevance: "supporting",
        },
      ],
      dissent_considered: "No dissent considered.",
      recommended_fix: {
        immediate: "Investigate checkout.",
        long_term: "Add monitoring.",
      },
    },
  },
]
