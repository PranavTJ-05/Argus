import type { Inngest } from "inngest"

import type { LiveAgentRunner } from "@argus/agents"
import type { ArgusBackendRegistry } from "@argus/backends"
import type { ArgusConfig } from "@argus/config"
import type { InvestigationsRepository } from "@argus/db"

import { runLiveAgentLoop } from "../agent-loop/live-loop.js"
import { runMockedAgentLoop } from "../agent-loop/mocked-loop.js"
import {
  type InvestigationRequestedEvent,
  investigationRequestedEventName,
  investigationRequestedEventSchema,
} from "../events.js"
import { assertNotCancelled } from "../workflow/cancellation.js"
import { assertWithinRoundLimit } from "../workflow/rounds.js"

export type InvestigationRequestedWorkflowDeps = {
  agents?: LiveAgentRunner
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
    | "cancelInvestigation"
    | "completeInvestigation"
    | "failInvestigation"
    | "getById"
    | "upsertAgentOutput"
    | "upsertTimelineMetadata"
    | "upsertToolCall"
  >
  modelAliases: ArgusConfig["llm"]["modelAliases"]
  resolveBackends?: (investigationId: string) => Promise<ArgusBackendRegistry>
}

export type InvestigationRequestedWorkflowResult = {
  investigationId: string
  incidentId: string
  currentPhase: "triage" | "trace" | "verdict" | "done"
  nextPhase: "triage" | "trace" | "verdict" | "done" | null
  currentRound: number
  eventSequence: number
  confidence: number | null
  status: "cancelled" | "completed" | "failed"
}

export async function handleInvestigationRequested(
  event: InvestigationRequestedEvent,
  deps: InvestigationRequestedWorkflowDeps,
): Promise<InvestigationRequestedWorkflowResult> {
  const parsedEvent = investigationRequestedEventSchema.parse(event)
  const investigation = await deps.investigations.getById(parsedEvent.data.investigationId)

  if (!investigation) {
    throw new Error(`investigation not found: ${parsedEvent.data.investigationId}`)
  }

  if (investigation.status === "completed" || investigation.status === "failed") {
    return {
      investigationId: investigation.id,
      incidentId: investigation.incidentId,
      currentPhase: investigation.currentPhase,
      nextPhase: "done",
      currentRound: investigation.currentRound,
      eventSequence: 0,
      confidence: investigation.confidence,
      status: investigation.status,
    }
  }

  assertNotCancelled(investigation.status)
  assertWithinRoundLimit(investigation.currentRound)

  if (isCancellationRequest(parsedEvent.data.triggerPayload)) {
    await deps.investigations.cancelInvestigation(investigation.id)
    const event = await deps.investigations.appendEvent({
      investigationId: investigation.id,
      eventType: "phase_changed",
      payload: {
        from: investigation.currentPhase,
        to: "done",
        roundNumber: investigation.currentRound,
        reason: "investigation cancelled by request",
      },
    })

    return {
      investigationId: investigation.id,
      incidentId: investigation.incidentId,
      currentPhase: investigation.currentPhase,
      nextPhase: "done",
      currentRound: investigation.currentRound,
      eventSequence: event.sequence,
      confidence: null,
      status: "cancelled",
    }
  }

  try {
    const backends = deps.resolveBackends
      ? await deps.resolveBackends(investigation.id)
      : deps.backends
    const agentLoopResult = deps.agents
      ? await runLiveAgentLoop(investigation, parsedEvent.data.triggerPayload, {
          agents: deps.agents,
          ...(backends ? { backends } : {}),
          investigations: deps.investigations,
        })
      : await runMockedAgentLoop(investigation, parsedEvent.data.triggerPayload, deps)

    return {
      investigationId: investigation.id,
      incidentId: investigation.incidentId,
      currentPhase: investigation.currentPhase,
      nextPhase: "done",
      currentRound: investigation.currentRound,
      eventSequence: agentLoopResult.eventSequence,
      confidence: agentLoopResult.confidence,
      status: "completed",
    }
  } catch (error) {
    await deps.investigations.failInvestigation(investigation.id)
    const event = await deps.investigations.appendEvent({
      investigationId: investigation.id,
      eventType: "error",
      payload: {
        message: error instanceof Error ? error.message : "workflow failed",
        phase: investigation.currentPhase,
        roundNumber: investigation.currentRound,
      },
    })

    return {
      investigationId: investigation.id,
      incidentId: investigation.incidentId,
      currentPhase: investigation.currentPhase,
      nextPhase: "done",
      currentRound: investigation.currentRound,
      eventSequence: event.sequence,
      confidence: null,
      status: "failed",
    }
  }
}

export function createInvestigationRequestedWorkflow(
  inngest: Inngest.Any,
  deps: InvestigationRequestedWorkflowDeps,
) {
  return inngest.createFunction(
    {
      id: "investigation-requested",
      name: "Investigation Requested",
    },
    {
      event: investigationRequestedEventName,
    },
    async ({ event }) =>
      handleInvestigationRequested(investigationRequestedEventSchema.parse(event), deps),
  )
}

function isCancellationRequest(triggerPayload: unknown): boolean {
  return (
    triggerPayload !== null &&
    typeof triggerPayload === "object" &&
    !Array.isArray(triggerPayload) &&
    "cancel" in triggerPayload &&
    triggerPayload.cancel === true
  )
}
