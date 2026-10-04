import type { EvalDataset } from "../index.js"

const ids = {
  checkoutTool: "11111111-1111-4111-8111-111111111111",
  checkoutFinding: "22222222-2222-4222-8222-222222222222",
  checkoutTimeline: "33333333-3333-4333-8333-333333333333",
  checkoutDissent: "44444444-4444-4444-8444-444444444444",
  searchTool: "55555555-5555-4555-8555-555555555555",
  searchFinding: "66666666-6666-4666-8666-666666666666",
  searchTimeline: "77777777-7777-4777-8777-777777777777",
  searchDissent: "88888888-8888-4888-8888-888888888888",
  authTool: "99999999-9999-4999-8999-999999999999",
  authFinding: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  authTimeline: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  authDissent: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  deployTool: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  deployFinding: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  deployTimeline: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  deployDissent: "12121212-1212-4212-8212-121212121212",
}

export const fullDataset: EvalDataset = [
  {
    id: "checkout-latency-payment-authorize",
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
        "Checkout latency is most likely caused by elevated payment_authorize span duration.",
      confidence: 0.68,
      timeline: [
        {
          timestamp: "2026-05-23T00:00:00.000Z",
          text: "Checkout p95 latency spiked and was dominated by payment_authorize spans.",
          source_ids: [ids.checkoutTimeline],
        },
      ],
      evidence_chain: [
        {
          claim: "Trace query showed checkout latency concentrated in payment_authorize.",
          sourceType: "tool_call",
          sourceId: ids.checkoutTool,
          relevance: "direct",
        },
        {
          claim: "Critic accepted the finding as highly plausible.",
          sourceType: "review_finding",
          sourceId: ids.checkoutFinding,
          relevance: "supporting",
        },
        {
          claim: "Timeline captured the latency spike window.",
          sourceType: "timeline_event",
          sourceId: ids.checkoutTimeline,
          relevance: "context",
        },
        {
          claim: "Counsel noted missing deploy evidence as a limitation.",
          sourceType: "dissent_entry",
          sourceId: ids.checkoutDissent,
          relevance: "contradicting",
        },
      ],
      dissent_considered:
        "Counsel dissent was considered and confidence was reduced for missing deploy evidence.",
      recommended_fix: {
        immediate: "Inspect payment_authorize dependency health and add timeout protection.",
        long_term: "Add trace-backed checkout latency regression detection.",
      },
    },
    baselineReport: {
      verdict: "Checkout is slow.",
      confidence: 0.9,
      timeline: [
        {
          timestamp: "2026-05-23T00:00:00.000Z",
          text: "Checkout latency increased.",
          source_ids: [ids.checkoutTimeline],
        },
      ],
      evidence_chain: [
        {
          claim: "Checkout latency increased.",
          sourceType: "review_finding",
          sourceId: ids.checkoutFinding,
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
  {
    id: "search-error-rate-index-timeout",
    incidentId: "search-errors-2026-05-23",
    description: "Search 500 rate increased after index timeout errors.",
    expectedRootCauseTerms: ["search", "index timeout"],
    expectedEvidenceSourceTypes: ["tool_call", "review_finding", "timeline_event"],
    expectedCounselCatch: false,
    expectedConfidence: 0.74,
    costUsd: 0.018,
    latencyMs: 1260,
    actualReport: {
      verdict: "Search failures are most likely caused by index timeout errors in search.",
      confidence: 0.74,
      timeline: [
        {
          timestamp: "2026-05-23T01:00:00.000Z",
          text: "Search 500s rose as index timeout errors appeared in logs.",
          source_ids: [ids.searchTimeline],
        },
      ],
      evidence_chain: [
        {
          claim: "Log query found repeated index timeout errors for search.",
          sourceType: "tool_call",
          sourceId: ids.searchTool,
          relevance: "direct",
        },
        {
          claim: "Critic found the search timeout finding credible.",
          sourceType: "review_finding",
          sourceId: ids.searchFinding,
          relevance: "supporting",
        },
        {
          claim: "Timeline aligned errors with customer-facing 500s.",
          sourceType: "timeline_event",
          sourceId: ids.searchTimeline,
          relevance: "context",
        },
      ],
      dissent_considered: "Counsel found no material unresolved dissent for this case.",
      recommended_fix: {
        immediate: "Reduce search index pressure and raise timeout diagnostics.",
        long_term: "Add search index saturation alerts tied to 500 rate.",
      },
    },
    baselineReport: {
      verdict: "Search is failing.",
      confidence: 0.65,
      timeline: [
        {
          timestamp: "2026-05-23T01:00:00.000Z",
          text: "Search errors increased.",
          source_ids: [ids.searchTimeline],
        },
      ],
      evidence_chain: [
        {
          claim: "Search errors increased.",
          sourceType: "timeline_event",
          sourceId: ids.searchTimeline,
          relevance: "context",
        },
      ],
      dissent_considered: "No dissent considered.",
      recommended_fix: {
        immediate: "Restart search.",
        long_term: "Add alerts.",
      },
    },
  },
  {
    id: "auth-login-region-latency",
    incidentId: "auth-login-2026-05-23",
    description: "Login latency was isolated to one region while global auth remained healthy.",
    expectedRootCauseTerms: ["login latency", "region"],
    expectedEvidenceSourceTypes: ["tool_call", "review_finding", "dissent_entry"],
    expectedCounselCatch: true,
    expectedConfidence: 0.57,
    costUsd: 0.021,
    latencyMs: 2210,
    actualReport: {
      verdict: "Login latency appears isolated to a single region rather than global auth failure.",
      confidence: 0.57,
      timeline: [
        {
          timestamp: "2026-05-23T02:00:00.000Z",
          text: "Regional login latency rose while global auth metrics stayed within normal range.",
          source_ids: [ids.authTimeline],
        },
      ],
      evidence_chain: [
        {
          claim: "Metric query showed regional login latency but normal global auth health.",
          sourceType: "tool_call",
          sourceId: ids.authTool,
          relevance: "direct",
        },
        {
          claim: "Critic marked the regional isolation finding plausible.",
          sourceType: "review_finding",
          sourceId: ids.authFinding,
          relevance: "supporting",
        },
        {
          claim: "Counsel warned that regional network evidence was incomplete.",
          sourceType: "dissent_entry",
          sourceId: ids.authDissent,
          relevance: "contradicting",
        },
      ],
      dissent_considered:
        "Counsel dissent about incomplete network evidence was kept unresolved, lowering confidence.",
      recommended_fix: {
        immediate: "Route affected-region login traffic away from the degraded path.",
        long_term: "Add per-region auth dependency probes.",
      },
    },
    baselineReport: {
      verdict: "Auth is down.",
      confidence: 0.86,
      timeline: [
        {
          timestamp: "2026-05-23T02:00:00.000Z",
          text: "Login latency increased.",
          source_ids: [ids.authTimeline],
        },
      ],
      evidence_chain: [
        {
          claim: "Login was slow.",
          sourceType: "review_finding",
          sourceId: ids.authFinding,
          relevance: "supporting",
        },
      ],
      dissent_considered: "No dissent considered.",
      recommended_fix: {
        immediate: "Restart auth.",
        long_term: "Monitor auth.",
      },
    },
  },
  {
    id: "deploy-regression-feature-flag",
    incidentId: "deploy-regression-2026-05-23",
    description: "A deployment plus feature flag rollout correlated with elevated API errors.",
    expectedRootCauseTerms: ["deployment", "feature flag"],
    expectedEvidenceSourceTypes: ["tool_call", "review_finding", "timeline_event", "dissent_entry"],
    expectedCounselCatch: true,
    expectedConfidence: 0.71,
    costUsd: 0.026,
    latencyMs: 1960,
    actualReport: {
      verdict:
        "Elevated API errors most likely came from a deployment interacting with a feature flag rollout.",
      confidence: 0.71,
      timeline: [
        {
          timestamp: "2026-05-23T03:00:00.000Z",
          text: "Deployment and feature flag rollout preceded the API error spike.",
          source_ids: [ids.deployTimeline],
        },
      ],
      evidence_chain: [
        {
          claim: "Deploy and flag tools both aligned with the start of API errors.",
          sourceType: "tool_call",
          sourceId: ids.deployTool,
          relevance: "direct",
        },
        {
          claim: "Critic judged the deploy and flag correlation credible.",
          sourceType: "review_finding",
          sourceId: ids.deployFinding,
          relevance: "supporting",
        },
        {
          claim: "Timeline placed rollout before the error spike.",
          sourceType: "timeline_event",
          sourceId: ids.deployTimeline,
          relevance: "context",
        },
        {
          claim: "Counsel noted correlation is not proof without rollback evidence.",
          sourceType: "dissent_entry",
          sourceId: ids.deployDissent,
          relevance: "contradicting",
        },
      ],
      dissent_considered:
        "Counsel dissent about correlation versus causation was considered before recommending rollback.",
      recommended_fix: {
        immediate: "Disable the feature flag and pause the deployment rollout.",
        long_term: "Require deploy and flag correlation checks in release monitoring.",
      },
    },
    baselineReport: {
      verdict: "API errors rose after a release.",
      confidence: 0.92,
      timeline: [
        {
          timestamp: "2026-05-23T03:00:00.000Z",
          text: "Errors rose after a release.",
          source_ids: [ids.deployTimeline],
        },
      ],
      evidence_chain: [
        {
          claim: "Errors rose after a release.",
          sourceType: "timeline_event",
          sourceId: ids.deployTimeline,
          relevance: "context",
        },
      ],
      dissent_considered: "No dissent considered.",
      recommended_fix: {
        immediate: "Rollback.",
        long_term: "Add release checks.",
      },
    },
  },
]
