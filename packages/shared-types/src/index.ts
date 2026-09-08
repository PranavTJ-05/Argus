import { z } from "zod"

export const phaseSchema = z.enum(["triage", "trace", "verdict", "done"])
export type Phase = z.infer<typeof phaseSchema>

export const investigationStatusSchema = z.enum(["running", "completed", "failed", "cancelled"])
export type InvestigationStatus = z.infer<typeof investigationStatusSchema>

export const agentRoleSchema = z.enum([
  "director",
  "trace_expert",
  "log_expert",
  "metric_expert",
  "deploy_expert",
  "flag_expert",
  "code_expert",
  "critic",
  "counsel",
  "reporter",
])
export type AgentRole = z.infer<typeof agentRoleSchema>

export const modelAliasSchema = z.enum([
  "director.primary",
  "expert.cheap",
  "critic.balanced",
  "counsel.balanced",
  "reporter.primary",
])
export type ModelAlias = z.infer<typeof modelAliasSchema>

export const journalEntryTypeSchema = z.enum([
  "decision",
  "observation",
  "finding",
  "question",
  "hypothesis",
  "action",
  "counter_evidence",
])
export type JournalEntryType = z.infer<typeof journalEntryTypeSchema>

export const prioritySchema = z.enum(["low", "medium", "high", "critical"])
export type Priority = z.infer<typeof prioritySchema>

export const credibilityBandSchema = z.enum([
  "trustworthy",
  "highly_plausible",
  "plausible",
  "speculative",
  "misguided",
])
export type CredibilityBand = z.infer<typeof credibilityBandSchema>

export const eventTypeSchema = z.enum([
  "phase_changed",
  "agent_started",
  "agent_completed",
  "tool_started",
  "tool_completed",
  "artifact_written",
  "error",
])
export type EventType = z.infer<typeof eventTypeSchema>

export const sourceTypeSchema = z.enum([
  "tool_call",
  "review_finding",
  "timeline_event",
  "dissent_entry",
  "evidence_gap",
])
export type SourceType = z.infer<typeof sourceTypeSchema>

export const citationRelevanceSchema = z.enum(["direct", "supporting", "context", "contradicting"])
export type CitationRelevance = z.infer<typeof citationRelevanceSchema>

export const uuidSchema = z.string().uuid()
export const nonEmptyStringSchema = z.string().trim().min(1)
export const zeroToOneSchema = z.number().min(0).max(1)
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
)

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export const citationSchema = z
  .object({
    claim: nonEmptyStringSchema,
    sourceType: sourceTypeSchema.exclude(["evidence_gap"]),
    sourceId: uuidSchema,
    relevance: citationRelevanceSchema,
  })
  .strict()
export type Citation = z.infer<typeof citationSchema>

export const investigationSummarySchema = z
  .object({
    id: uuidSchema,
    incidentId: nonEmptyStringSchema,
    status: investigationStatusSchema,
    currentPhase: phaseSchema,
    currentRound: z.number().int().nonnegative(),
    confidence: zeroToOneSchema.nullable(),
    totalCostUsd: z.number().nonnegative().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
export type InvestigationSummary = z.infer<typeof investigationSummarySchema>

export const investigationListSchema = z.array(investigationSummarySchema)
export type InvestigationList = z.infer<typeof investigationListSchema>

export const createInvestigationRequestSchema = z
  .object({
    incidentId: nonEmptyStringSchema,
    triggerPayload: jsonValueSchema.default({}),
  })
  .strict()
export type CreateInvestigationRequest = z.infer<typeof createInvestigationRequestSchema>

export const journalEntryArtifactSchema = z
  .object({
    id: uuidSchema,
    roundNumber: z.number().int().nonnegative(),
    phase: phaseSchema,
    entryType: journalEntryTypeSchema,
    content: nonEmptyStringSchema,
    priority: prioritySchema.nullable(),
    citedToolCalls: z.array(uuidSchema),
    citedFindings: z.array(uuidSchema),
    createdAt: z.string().datetime(),
  })
  .strict()
export type JournalEntryArtifact = z.infer<typeof journalEntryArtifactSchema>

export const reviewFindingArtifactSchema = z
  .object({
    id: uuidSchema,
    roundNumber: z.number().int().nonnegative(),
    expertName: nonEmptyStringSchema,
    findingText: nonEmptyStringSchema,
    credibility: zeroToOneSchema,
    credibilityBand: credibilityBandSchema,
    citedToolCalls: z.array(uuidSchema),
    criticNotes: nonEmptyStringSchema.nullable(),
    createdAt: z.string().datetime(),
  })
  .strict()
export type ReviewFindingArtifact = z.infer<typeof reviewFindingArtifactSchema>

export const timelineEventArtifactSchema = z
  .object({
    id: uuidSchema,
    roundNumber: z.number().int().nonnegative(),
    eventTimestamp: z.string().datetime(),
    eventText: nonEmptyStringSchema,
    sourceFindings: z.array(uuidSchema),
  })
  .strict()
export type TimelineEventArtifact = z.infer<typeof timelineEventArtifactSchema>

export const dissentEntryArtifactSchema = z
  .object({
    id: uuidSchema,
    roundNumber: z.number().int().nonnegative(),
    counterArgument: nonEmptyStringSchema,
    dissentStrength: zeroToOneSchema,
    evidenceCited: jsonValueSchema,
    directorResponse: nonEmptyStringSchema.nullable(),
    resolved: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict()
export type DissentEntryArtifact = z.infer<typeof dissentEntryArtifactSchema>

export const investigationArtifactsSchema = z
  .object({
    investigationId: uuidSchema,
    journalEntries: z.array(journalEntryArtifactSchema),
    reviewFindings: z.array(reviewFindingArtifactSchema),
    timelineEvents: z.array(timelineEventArtifactSchema),
    dissentEntries: z.array(dissentEntryArtifactSchema),
  })
  .strict()
export type InvestigationArtifacts = z.infer<typeof investigationArtifactsSchema>

export const investigationEventSchema = z
  .object({
    id: uuidSchema,
    investigationId: uuidSchema,
    sequence: z.number().int().positive(),
    eventType: eventTypeSchema,
    payload: jsonValueSchema,
    createdAt: z.string().datetime(),
  })
  .strict()
export type InvestigationEvent = z.infer<typeof investigationEventSchema>

export const toolCallArtifactSchema = z
  .object({
    id: uuidSchema,
    investigationId: uuidSchema,
    stepKey: nonEmptyStringSchema,
    expertName: nonEmptyStringSchema,
    toolName: nonEmptyStringSchema,
    arguments: jsonValueSchema,
    result: jsonValueSchema.nullable(),
    error: nonEmptyStringSchema.nullable(),
    durationMs: z.number().int().nonnegative().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict()
export type ToolCallArtifact = z.infer<typeof toolCallArtifactSchema>

export const journalEntryInputSchema = z
  .object({
    entryType: journalEntryTypeSchema,
    content: nonEmptyStringSchema,
    priority: prioritySchema.optional(),
    citedToolCalls: z.array(uuidSchema).default([]),
    citedFindings: z.array(uuidSchema).default([]),
  })
  .strict()
export type JournalEntryInput = z.infer<typeof journalEntryInputSchema>

export const expertDispatchSchema = z
  .object({
    name: agentRoleSchema.extract([
      "trace_expert",
      "log_expert",
      "metric_expert",
      "deploy_expert",
      "flag_expert",
      "code_expert",
    ]),
    questions: z.array(nonEmptyStringSchema).min(1),
  })
  .strict()
export type ExpertDispatch = z.infer<typeof expertDispatchSchema>

export const directorActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("write_journal"),
      entries: z.array(journalEntryInputSchema).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("dispatch_experts"),
      experts: z.array(expertDispatchSchema).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("advance_phase"),
      from: phaseSchema.exclude(["done"]),
      to: phaseSchema,
      reason: nonEmptyStringSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("declare_verdict"),
      hypothesis: nonEmptyStringSchema,
    })
    .strict(),
])
export type DirectorAction = z.infer<typeof directorActionSchema>

export const expertOutputSchema = z
  .object({
    findings: z.array(
      z
        .object({
          text: nonEmptyStringSchema,
          cited_tool_calls: z.array(uuidSchema).min(1),
          confidence_note: nonEmptyStringSchema.optional(),
        })
        .strict(),
    ),
    no_findings: z
      .array(
        z
          .object({
            searched: nonEmptyStringSchema,
            reason: nonEmptyStringSchema,
            cited_tool_calls: z.array(uuidSchema),
          })
          .strict(),
      )
      .optional(),
  })
  .strict()
export type ExpertOutput = z.infer<typeof expertOutputSchema>

export const criticOutputSchema = z
  .object({
    reviewed_findings: z.array(
      z
        .object({
          expert_name: agentRoleSchema,
          finding_text: nonEmptyStringSchema,
          credibility: zeroToOneSchema,
          credibility_band: credibilityBandSchema,
          cited_tool_calls: z.array(uuidSchema),
          critic_notes: nonEmptyStringSchema,
        })
        .strict(),
    ),
    timeline_events: z.array(
      z
        .object({
          event_timestamp: z.string().datetime(),
          event_text: nonEmptyStringSchema,
          source_findings: z.array(uuidSchema),
        })
        .strict(),
    ),
    evidence_gaps: z.array(nonEmptyStringSchema),
  })
  .strict()
export type CriticOutput = z.infer<typeof criticOutputSchema>

export const counselOutputSchema = z
  .object({
    dissent_entries: z.array(
      z
        .object({
          counter_argument: nonEmptyStringSchema,
          dissent_strength: zeroToOneSchema,
          evidence_cited: z.array(
            z
              .object({
                source_type: sourceTypeSchema,
                source_id: uuidSchema.optional(),
                description: nonEmptyStringSchema.optional(),
              })
              .strict(),
          ),
          proposed_alternative: nonEmptyStringSchema.optional(),
        })
        .strict(),
    ),
  })
  .strict()
export type CounselOutput = z.infer<typeof counselOutputSchema>

export const reporterOutputSchema = z
  .object({
    verdict: nonEmptyStringSchema,
    confidence: zeroToOneSchema,
    timeline: z.array(
      z
        .object({
          timestamp: z.string().datetime(),
          text: nonEmptyStringSchema,
          source_ids: z.array(uuidSchema),
        })
        .strict(),
    ),
    evidence_chain: z.array(citationSchema),
    dissent_considered: nonEmptyStringSchema,
    recommended_fix: z
      .object({
        immediate: nonEmptyStringSchema,
        long_term: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict()
export type ReporterOutput = z.infer<typeof reporterOutputSchema>

export const investigationReportSchema = z
  .object({
    investigationId: uuidSchema,
    finalReport: reporterOutputSchema.nullable(),
    confidence: zeroToOneSchema.nullable(),
  })
  .strict()
export type InvestigationReport = z.infer<typeof investigationReportSchema>
