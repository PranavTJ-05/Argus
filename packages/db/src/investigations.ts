import {
  type AgentRole,
  type CredibilityBand,
  type DissentEntryArtifact,
  type EventType,
  type InvestigationArtifacts,
  type InvestigationEvent,
  type InvestigationReport,
  type InvestigationSummary,
  type JournalEntryArtifact,
  type JournalEntryType,
  type JsonValue,
  type ModelAlias,
  type Phase,
  type Priority,
  type ReporterOutput,
  type ReviewFindingArtifact,
  type TimelineEventArtifact,
  type ToolCallArtifact,
  dissentEntryArtifactSchema,
  investigationArtifactsSchema,
  investigationEventSchema,
  investigationReportSchema,
  investigationSummarySchema,
  journalEntryArtifactSchema,
  reviewFindingArtifactSchema,
  timelineEventArtifactSchema,
  toolCallArtifactSchema,
} from "@argus/shared-types"
import { and, asc, desc, eq, gt } from "drizzle-orm"

import type { ArgusDatabase } from "./client.js"
import {
  agentOutputs,
  dissentEntries,
  investigationEvents,
  investigations,
  journalEntries,
  llmCalls,
  reviewFindings,
  timelineEvents,
  timelineMetadata,
  toolCalls,
} from "./schema.js"

export type CreateInvestigationInput = {
  incidentId: string
  workspaceId?: string | null
  triggerPayload: typeof investigations.$inferInsert.triggerPayload
}

export type AppendInvestigationEventInput = {
  investigationId: string
  eventType: EventType
  payload: typeof investigationEvents.$inferInsert.payload
}

export type AppendJournalEntryInput = {
  investigationId: string
  roundNumber: number
  phase: Phase
  entryType: JournalEntryType
  content: string
  priority?: Priority | null
  citedToolCalls?: string[]
  citedFindings?: string[]
}

export type AppendReviewFindingInput = {
  investigationId: string
  roundNumber: number
  expertName: AgentRole
  findingText: string
  credibility: number
  credibilityBand: CredibilityBand
  citedToolCalls: string[]
  criticNotes: string
}

export type AppendTimelineEventInput = {
  investigationId: string
  roundNumber: number
  eventTimestamp: Date
  eventText: string
  sourceFindings: string[]
}

export type AppendDissentEntryInput = {
  investigationId: string
  roundNumber: number
  counterArgument: string
  dissentStrength: number
  evidenceCited: JsonValue
  directorResponse?: string | null
  resolved?: boolean
}

export type ToolCallRecord = {
  id: string
  investigationId: string
  stepKey: string
  expertName: AgentRole
  toolName: string
  arguments: JsonValue
  result: JsonValue | null
  error: string | null
  durationMs: number | null
}

export type UpsertToolCallInput = Omit<ToolCallRecord, "id">

export type AgentOutputRecord = {
  id: string
  investigationId: string
  roundNumber: number
  phase: Phase
  agentRole: AgentRole
  stepKey: string
  modelAlias: ModelAlias
  modelId: string
  promptVersion: string
  inputSnapshot: JsonValue
  outputJson: JsonValue
  validationError: string | null
}

export type UpsertAgentOutputInput = Omit<AgentOutputRecord, "id">

export type AppendLlmCallInput = {
  investigationId: string
  agentRole: AgentRole
  modelAlias: ModelAlias
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs: number
  traceId?: string | null
}

export type CompleteInvestigationInput = {
  id: string
  finalReport: ReporterOutput
  confidence: number
}

export type AdvanceInvestigationPhaseInput = {
  id: string
  phase: Phase
  roundNumber: number
}

export type UpsertTimelineMetadataInput = {
  investigationId: string
  confidenceScore: number | null
  evidenceGaps: string[]
}

export type InvestigationsRepository = {
  create: (input: CreateInvestigationInput) => Promise<InvestigationSummary>
  list: (workspaceId?: string | null) => Promise<InvestigationSummary[]>
  getById: (id: string, workspaceId?: string | null) => Promise<InvestigationSummary | null>
  getReport: (id: string, workspaceId?: string | null) => Promise<InvestigationReport | null>
  getArtifacts: (id: string, workspaceId?: string | null) => Promise<InvestigationArtifacts | null>
  getToolCall: (
    investigationId: string,
    toolCallId: string,
    workspaceId?: string | null,
  ) => Promise<ToolCallArtifact | null>
  getEventsAfter: (
    id: string,
    sequence: number,
    workspaceId?: string | null,
  ) => Promise<InvestigationEvent[] | null>
  appendEvent: (input: AppendInvestigationEventInput) => Promise<InvestigationEvent>
  appendJournalEntry: (input: AppendJournalEntryInput) => Promise<JournalEntryArtifact>
  appendReviewFinding: (input: AppendReviewFindingInput) => Promise<ReviewFindingArtifact>
  appendTimelineEvent: (input: AppendTimelineEventInput) => Promise<TimelineEventArtifact>
  appendDissentEntry: (input: AppendDissentEntryInput) => Promise<DissentEntryArtifact>
  appendLlmCall: (input: AppendLlmCallInput) => Promise<void>
  upsertToolCall: (input: UpsertToolCallInput) => Promise<ToolCallRecord>
  upsertAgentOutput: (input: UpsertAgentOutputInput) => Promise<AgentOutputRecord>
  advancePhase: (input: AdvanceInvestigationPhaseInput) => Promise<InvestigationSummary>
  upsertTimelineMetadata: (input: UpsertTimelineMetadataInput) => Promise<void>
  completeInvestigation: (input: CompleteInvestigationInput) => Promise<InvestigationSummary>
  failInvestigation: (id: string) => Promise<InvestigationSummary>
  cancelInvestigation: (id: string) => Promise<InvestigationSummary>
}

export function createInvestigationsRepository(db: ArgusDatabase): InvestigationsRepository {
  return {
    async create(input) {
      const [row] = await db
        .insert(investigations)
        .values({
          workspaceId: input.workspaceId ?? null,
          incidentId: input.incidentId,
          status: "running",
          currentPhase: "triage",
          currentRound: 0,
          triggerPayload: input.triggerPayload,
        })
        .returning()

      if (!row) {
        throw new Error("failed to create investigation")
      }

      return mapInvestigationSummary(row)
    },

    async list(workspaceId) {
      const rows = await db
        .select()
        .from(investigations)
        .where(workspaceId ? eq(investigations.workspaceId, workspaceId) : undefined)
        .orderBy(desc(investigations.createdAt))

      return rows.map(mapInvestigationSummary)
    },

    async getById(id, workspaceId) {
      const [row] = await db
        .select()
        .from(investigations)
        .where(
          workspaceId
            ? and(eq(investigations.id, id), eq(investigations.workspaceId, workspaceId))
            : eq(investigations.id, id),
        )
        .limit(1)

      return row ? mapInvestigationSummary(row) : null
    },

    async getReport(id, workspaceId) {
      const [row] = await db
        .select()
        .from(investigations)
        .where(
          workspaceId
            ? and(eq(investigations.id, id), eq(investigations.workspaceId, workspaceId))
            : eq(investigations.id, id),
        )
        .limit(1)

      if (!row) {
        return null
      }

      return investigationReportSchema.parse({
        investigationId: row.id,
        finalReport: row.finalReport,
        confidence: row.confidence === null ? null : Number(row.confidence),
      })
    },

    async getArtifacts(id, workspaceId) {
      const investigation = await this.getById(id, workspaceId)

      if (!investigation) {
        return null
      }

      const [journalRows, reviewRows, timelineRows, dissentRows] = await Promise.all([
        db
          .select()
          .from(journalEntries)
          .where(eq(journalEntries.investigationId, id))
          .orderBy(asc(journalEntries.roundNumber), asc(journalEntries.createdAt)),
        db
          .select()
          .from(reviewFindings)
          .where(eq(reviewFindings.investigationId, id))
          .orderBy(asc(reviewFindings.roundNumber), asc(reviewFindings.createdAt)),
        db
          .select()
          .from(timelineEvents)
          .where(eq(timelineEvents.investigationId, id))
          .orderBy(asc(timelineEvents.roundNumber), asc(timelineEvents.eventTimestamp)),
        db
          .select()
          .from(dissentEntries)
          .where(eq(dissentEntries.investigationId, id))
          .orderBy(asc(dissentEntries.roundNumber), asc(dissentEntries.createdAt)),
      ])

      return investigationArtifactsSchema.parse({
        investigationId: id,
        journalEntries: journalRows.map((row) => ({
          id: row.id,
          roundNumber: row.roundNumber,
          phase: row.phase,
          entryType: row.entryType,
          content: row.content,
          priority: row.priority,
          citedToolCalls: row.citedToolCalls,
          citedFindings: row.citedFindings,
          createdAt: row.createdAt.toISOString(),
        })),
        reviewFindings: reviewRows.map((row) => ({
          id: row.id,
          roundNumber: row.roundNumber,
          expertName: row.expertName,
          findingText: row.findingText,
          credibility: Number(row.credibility),
          credibilityBand: row.credibilityBand,
          citedToolCalls: row.citedToolCalls,
          criticNotes: row.criticNotes,
          createdAt: row.createdAt.toISOString(),
        })),
        timelineEvents: timelineRows.map((row) => ({
          id: row.id,
          roundNumber: row.roundNumber,
          eventTimestamp: row.eventTimestamp.toISOString(),
          eventText: row.eventText,
          sourceFindings: row.sourceFindings,
        })),
        dissentEntries: dissentRows.map((row) => ({
          id: row.id,
          roundNumber: row.roundNumber,
          counterArgument: row.counterArgument,
          dissentStrength: Number(row.dissentStrength),
          evidenceCited: row.evidenceCited,
          directorResponse: row.directorResponse,
          resolved: row.resolved,
          createdAt: row.createdAt.toISOString(),
        })),
      })
    },

    async getToolCall(investigationId, toolCallId, workspaceId) {
      const investigation = await this.getById(investigationId, workspaceId)

      if (!investigation) {
        return null
      }

      const [row] = await db
        .select()
        .from(toolCalls)
        .where(and(eq(toolCalls.investigationId, investigationId), eq(toolCalls.id, toolCallId)))
        .limit(1)

      if (!row) {
        return null
      }

      return toolCallArtifactSchema.parse({
        id: row.id,
        investigationId: row.investigationId,
        stepKey: row.stepKey,
        expertName: row.expertName,
        toolName: row.toolName,
        arguments: row.arguments,
        result: row.result ?? null,
        error: row.error,
        durationMs: row.durationMs,
        createdAt: row.createdAt.toISOString(),
      })
    },

    async getEventsAfter(id, sequence, workspaceId) {
      const investigation = await this.getById(id, workspaceId)

      if (!investigation) {
        return null
      }

      const rows = await db
        .select()
        .from(investigationEvents)
        .where(
          and(
            eq(investigationEvents.investigationId, id),
            gt(investigationEvents.sequence, sequence),
          ),
        )
        .orderBy(asc(investigationEvents.sequence))

      return rows.map((row) =>
        investigationEventSchema.parse({
          id: row.id,
          investigationId: row.investigationId,
          sequence: row.sequence,
          eventType: row.eventType,
          payload: row.payload,
          createdAt: row.createdAt.toISOString(),
        }),
      )
    },

    async appendEvent(input) {
      const [row] = await db
        .insert(investigationEvents)
        .values({
          investigationId: input.investigationId,
          eventType: input.eventType,
          payload: input.payload,
        })
        .returning()

      if (!row) {
        throw new Error("failed to append investigation event")
      }

      return investigationEventSchema.parse({
        id: row.id,
        investigationId: row.investigationId,
        sequence: row.sequence,
        eventType: row.eventType,
        payload: row.payload,
        createdAt: row.createdAt.toISOString(),
      })
    },

    async appendJournalEntry(input) {
      const [row] = await db
        .insert(journalEntries)
        .values({
          investigationId: input.investigationId,
          roundNumber: input.roundNumber,
          phase: input.phase,
          entryType: input.entryType,
          content: input.content,
          priority: input.priority ?? null,
          citedToolCalls: input.citedToolCalls ?? [],
          citedFindings: input.citedFindings ?? [],
        })
        .returning()

      if (!row) {
        throw new Error("failed to append journal entry")
      }

      return journalEntryArtifactSchema.parse({
        id: row.id,
        roundNumber: row.roundNumber,
        phase: row.phase,
        entryType: row.entryType,
        content: row.content,
        priority: row.priority,
        citedToolCalls: row.citedToolCalls,
        citedFindings: row.citedFindings,
        createdAt: row.createdAt.toISOString(),
      })
    },

    async appendReviewFinding(input) {
      const [row] = await db
        .insert(reviewFindings)
        .values({
          investigationId: input.investigationId,
          roundNumber: input.roundNumber,
          expertName: input.expertName,
          findingText: input.findingText,
          credibility: input.credibility.toFixed(2),
          credibilityBand: input.credibilityBand,
          citedToolCalls: input.citedToolCalls,
          criticNotes: input.criticNotes,
        })
        .returning()

      if (!row) {
        throw new Error("failed to append review finding")
      }

      return reviewFindingArtifactSchema.parse({
        id: row.id,
        roundNumber: row.roundNumber,
        expertName: row.expertName,
        findingText: row.findingText,
        credibility: Number(row.credibility),
        credibilityBand: row.credibilityBand,
        citedToolCalls: row.citedToolCalls,
        criticNotes: row.criticNotes,
        createdAt: row.createdAt.toISOString(),
      })
    },

    async appendTimelineEvent(input) {
      const [row] = await db
        .insert(timelineEvents)
        .values({
          investigationId: input.investigationId,
          roundNumber: input.roundNumber,
          eventTimestamp: input.eventTimestamp,
          eventText: input.eventText,
          sourceFindings: input.sourceFindings,
        })
        .returning()

      if (!row) {
        throw new Error("failed to append timeline event")
      }

      return timelineEventArtifactSchema.parse({
        id: row.id,
        roundNumber: row.roundNumber,
        eventTimestamp: row.eventTimestamp.toISOString(),
        eventText: row.eventText,
        sourceFindings: row.sourceFindings,
      })
    },

    async appendDissentEntry(input) {
      const [row] = await db
        .insert(dissentEntries)
        .values({
          investigationId: input.investigationId,
          roundNumber: input.roundNumber,
          counterArgument: input.counterArgument,
          dissentStrength: input.dissentStrength.toFixed(2),
          evidenceCited: input.evidenceCited,
          directorResponse: input.directorResponse ?? null,
          resolved: input.resolved ?? false,
        })
        .returning()

      if (!row) {
        throw new Error("failed to append dissent entry")
      }

      return dissentEntryArtifactSchema.parse({
        id: row.id,
        roundNumber: row.roundNumber,
        counterArgument: row.counterArgument,
        dissentStrength: Number(row.dissentStrength),
        evidenceCited: row.evidenceCited,
        directorResponse: row.directorResponse,
        resolved: row.resolved,
        createdAt: row.createdAt.toISOString(),
      })
    },

    async appendLlmCall(input) {
      await db.insert(llmCalls).values({
        investigationId: input.investigationId,
        agentRole: input.agentRole,
        modelAlias: input.modelAlias,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costUsd: input.costUsd.toFixed(6),
        durationMs: input.durationMs,
        traceId: input.traceId ?? null,
      })
    },

    async upsertToolCall(input) {
      const [row] = await db
        .insert(toolCalls)
        .values({
          investigationId: input.investigationId,
          stepKey: input.stepKey,
          expertName: input.expertName,
          toolName: input.toolName,
          arguments: input.arguments,
          result: input.result,
          error: input.error,
          durationMs: input.durationMs,
        })
        .onConflictDoUpdate({
          target: [toolCalls.investigationId, toolCalls.stepKey],
          set: {
            expertName: input.expertName,
            toolName: input.toolName,
            arguments: input.arguments,
            result: input.result,
            error: input.error,
            durationMs: input.durationMs,
          },
        })
        .returning()

      if (!row) {
        throw new Error("failed to upsert tool call")
      }

      return {
        id: row.id,
        investigationId: row.investigationId,
        stepKey: row.stepKey,
        expertName: row.expertName as AgentRole,
        toolName: row.toolName,
        arguments: row.arguments,
        result: row.result ?? null,
        error: row.error,
        durationMs: row.durationMs,
      }
    },

    async upsertAgentOutput(input) {
      const [row] = await db
        .insert(agentOutputs)
        .values({
          investigationId: input.investigationId,
          roundNumber: input.roundNumber,
          phase: input.phase,
          agentRole: input.agentRole,
          stepKey: input.stepKey,
          modelAlias: input.modelAlias,
          modelId: input.modelId,
          promptVersion: input.promptVersion,
          inputSnapshot: input.inputSnapshot,
          outputJson: input.outputJson,
          validationError: input.validationError,
        })
        .onConflictDoUpdate({
          target: [agentOutputs.investigationId, agentOutputs.stepKey],
          set: {
            roundNumber: input.roundNumber,
            phase: input.phase,
            agentRole: input.agentRole,
            modelAlias: input.modelAlias,
            modelId: input.modelId,
            promptVersion: input.promptVersion,
            inputSnapshot: input.inputSnapshot,
            outputJson: input.outputJson,
            validationError: input.validationError,
          },
        })
        .returning()

      if (!row) {
        throw new Error("failed to upsert agent output")
      }

      return {
        id: row.id,
        investigationId: row.investigationId,
        roundNumber: row.roundNumber,
        phase: row.phase,
        agentRole: row.agentRole as AgentRole,
        stepKey: row.stepKey,
        modelAlias: row.modelAlias as ModelAlias,
        modelId: row.modelId,
        promptVersion: row.promptVersion,
        inputSnapshot: row.inputSnapshot,
        outputJson: row.outputJson,
        validationError: row.validationError,
      }
    },

    async advancePhase(input) {
      const [row] = await db
        .update(investigations)
        .set({
          currentPhase: input.phase,
          currentRound: input.roundNumber,
          status: "running",
          updatedAt: new Date(),
        })
        .where(eq(investigations.id, input.id))
        .returning()

      if (!row) {
        throw new Error(`investigation not found: ${input.id}`)
      }

      return mapInvestigationSummary(row)
    },

    async upsertTimelineMetadata(input) {
      await db
        .insert(timelineMetadata)
        .values({
          investigationId: input.investigationId,
          confidenceScore: input.confidenceScore === null ? null : input.confidenceScore.toFixed(2),
          evidenceGaps: input.evidenceGaps,
        })
        .onConflictDoUpdate({
          target: timelineMetadata.investigationId,
          set: {
            confidenceScore:
              input.confidenceScore === null ? null : input.confidenceScore.toFixed(2),
            evidenceGaps: input.evidenceGaps,
          },
        })
    },

    async completeInvestigation(input) {
      const [row] = await db
        .update(investigations)
        .set({
          status: "completed",
          currentPhase: "done",
          finalReport: input.finalReport,
          confidence: input.confidence.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(investigations.id, input.id))
        .returning()

      if (!row) {
        throw new Error(`investigation not found: ${input.id}`)
      }

      return mapInvestigationSummary(row)
    },

    async failInvestigation(id) {
      const [row] = await db
        .update(investigations)
        .set({
          status: "failed",
          currentPhase: "done",
          updatedAt: new Date(),
        })
        .where(eq(investigations.id, id))
        .returning()

      if (!row) {
        throw new Error(`investigation not found: ${id}`)
      }

      return mapInvestigationSummary(row)
    },

    async cancelInvestigation(id) {
      const [row] = await db
        .update(investigations)
        .set({
          status: "cancelled",
          currentPhase: "done",
          updatedAt: new Date(),
        })
        .where(eq(investigations.id, id))
        .returning()

      if (!row) {
        throw new Error(`investigation not found: ${id}`)
      }

      return mapInvestigationSummary(row)
    },
  }
}

function mapInvestigationSummary(row: typeof investigations.$inferSelect): InvestigationSummary {
  return investigationSummarySchema.parse({
    id: row.id,
    incidentId: row.incidentId,
    status: row.status,
    currentPhase: row.currentPhase,
    currentRound: row.currentRound,
    confidence: row.confidence === null ? null : Number(row.confidence),
    totalCostUsd: row.totalCostUsd === null ? null : Number(row.totalCostUsd),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}
