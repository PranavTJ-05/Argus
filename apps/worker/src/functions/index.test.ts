import { describe, expect, it } from "vitest"

import type { InvestigationRequestedWorkflowDeps } from "./investigation-requested.js"

import { createArgusFunctions } from "./index.js"

describe("Argus functions", () => {
  it("registers the investigation requested workflow", () => {
    const deps: InvestigationRequestedWorkflowDeps = {
      modelAliases: {
        "director.primary": "director-model",
        "expert.cheap": "expert-model",
        "critic.balanced": "critic-model",
        "counsel.balanced": "counsel-model",
        "reporter.primary": "reporter-model",
      },
      investigations: {
        async advancePhase() {
          throw new Error("advancePhase should not run")
        },
        async appendDissentEntry() {
          throw new Error("appendDissentEntry should not run")
        },
        async appendEvent(input) {
          return {
            id: "33333333-3333-4333-8333-333333333333",
            investigationId: input.investigationId,
            sequence: 1,
            eventType: input.eventType,
            payload: input.payload,
            createdAt: "2026-05-23T00:00:00.000Z",
          }
        },
        async appendJournalEntry() {
          throw new Error("appendJournalEntry should not run")
        },
        async appendReviewFinding() {
          throw new Error("appendReviewFinding should not run")
        },
        async appendTimelineEvent() {
          throw new Error("appendTimelineEvent should not run")
        },
        async completeInvestigation() {
          throw new Error("completeInvestigation should not run")
        },
        async cancelInvestigation() {
          throw new Error("cancelInvestigation should not run")
        },
        async failInvestigation() {
          throw new Error("failInvestigation should not run")
        },
        async getById() {
          return null
        },
        async upsertAgentOutput() {
          throw new Error("upsertAgentOutput should not run")
        },
        async upsertTimelineMetadata() {
          throw new Error("upsertTimelineMetadata should not run")
        },
        async upsertToolCall() {
          throw new Error("upsertToolCall should not run")
        },
      },
    }
    const inngest = {
      createFunction() {
        return {
          id: "investigation-requested",
        }
      },
    }

    expect(createArgusFunctions(inngest, deps)).toEqual([
      {
        id: "investigation-requested",
      },
    ])
  })
})
