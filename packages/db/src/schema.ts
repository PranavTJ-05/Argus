import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export const investigationStatusEnum = pgEnum("investigation_status", [
  "running",
  "completed",
  "failed",
  "cancelled",
])

export const phaseEnum = pgEnum("phase", ["triage", "trace", "verdict", "done"])

export const journalEntryTypeEnum = pgEnum("journal_entry_type", [
  "decision",
  "observation",
  "finding",
  "question",
  "hypothesis",
  "action",
  "counter_evidence",
])

export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "critical"])

export const workspaceRoleEnum = pgEnum("workspace_role", ["admin", "engineer", "viewer"])

export const workspaceStatusEnum = pgEnum("workspace_status", ["active", "suspended", "disabled"])

export const workspaceApiKeyStatusEnum = pgEnum("workspace_api_key_status", ["active", "revoked"])

export const workspaceIntegrationProviderEnum = pgEnum("workspace_integration_provider", [
  "github",
  "prometheus",
  "loki",
  "tempo",
  "launchdarkly",
])

export const workspaceIntegrationStatusEnum = pgEnum("workspace_integration_status", [
  "connected",
  "disabled",
])

export const credibilityBandEnum = pgEnum("credibility_band", [
  "trustworthy",
  "highly_plausible",
  "plausible",
  "speculative",
  "misguided",
])

export const investigationEventTypeEnum = pgEnum("investigation_event_type", [
  "phase_changed",
  "agent_started",
  "agent_completed",
  "tool_started",
  "tool_completed",
  "artifact_written",
  "error",
])

export const investigations = pgTable(
  "investigations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id),
    incidentId: text("incident_id").notNull(),
    status: investigationStatusEnum("status").notNull(),
    currentPhase: phaseEnum("current_phase").notNull(),
    currentRound: integer("current_round").notNull().default(0),
    triggerPayload: jsonb("trigger_payload").$type<JsonValue>().notNull(),
    finalReport: jsonb("final_report").$type<JsonValue>(),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    totalCostUsd: numeric("total_cost_usd", { precision: 10, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    confidenceRange: check(
      "investigations_confidence_range",
      sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 1)`,
    ),
  }),
)

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: workspaceStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex("uidx_workspaces_slug").on(table.slug),
  }),
)

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("uidx_users_email").on(table.email),
  }),
)

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: workspaceRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceUserUnique: uniqueIndex("uidx_workspace_memberships_workspace_user").on(
      table.workspaceId,
      table.userId,
    ),
  }),
)

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("uidx_auth_sessions_token_hash").on(table.tokenHash),
  }),
)

export const workspaceApiKeys = pgTable(
  "workspace_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    status: workspaceApiKeyStatusEnum("status").notNull().default("active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    keyHashUnique: uniqueIndex("uidx_workspace_api_keys_key_hash").on(table.keyHash),
    workspaceIdx: index("idx_workspace_api_keys_workspace").on(table.workspaceId),
  }),
)

export const workspaceIntegrations = pgTable(
  "workspace_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    provider: workspaceIntegrationProviderEnum("provider").notNull(),
    status: workspaceIntegrationStatusEnum("status").notNull().default("connected"),
    config: jsonb("config").$type<JsonValue>().notNull().default({}),
    secretCiphertext: text("secret_ciphertext"),
    secretKeyHint: text("secret_key_hint"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceProviderUnique: uniqueIndex("uidx_workspace_integrations_workspace_provider").on(
      table.workspaceId,
      table.provider,
    ),
    workspaceIdx: index("idx_workspace_integrations_workspace").on(table.workspaceId),
  }),
)

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id),
    roundNumber: integer("round_number").notNull(),
    phase: phaseEnum("phase").notNull(),
    entryType: journalEntryTypeEnum("entry_type").notNull(),
    content: text("content").notNull(),
    priority: priorityEnum("priority"),
    citedToolCalls: jsonb("cited_tool_calls").$type<string[]>().notNull().default([]),
    citedFindings: jsonb("cited_findings").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    investigationRoundIdx: index("idx_journal_investigation_round").on(
      table.investigationId,
      table.roundNumber,
    ),
  }),
)

export const reviewFindings = pgTable(
  "review_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id),
    roundNumber: integer("round_number").notNull(),
    expertName: text("expert_name").notNull(),
    findingText: text("finding_text").notNull(),
    credibility: numeric("credibility", { precision: 3, scale: 2 }).notNull(),
    credibilityBand: credibilityBandEnum("credibility_band").notNull(),
    citedToolCalls: jsonb("cited_tool_calls").$type<string[]>().notNull(),
    criticNotes: text("critic_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    investigationRoundIdx: index("idx_review_investigation_round").on(
      table.investigationId,
      table.roundNumber,
    ),
    credibilityRange: check(
      "review_findings_credibility_range",
      sql`${table.credibility} >= 0 and ${table.credibility} <= 1`,
    ),
  }),
)

export const timelineEvents = pgTable("timeline_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  investigationId: uuid("investigation_id")
    .notNull()
    .references(() => investigations.id),
  roundNumber: integer("round_number").notNull(),
  eventTimestamp: timestamp("event_timestamp", { withTimezone: true }).notNull(),
  eventText: text("event_text").notNull(),
  sourceFindings: jsonb("source_findings").$type<string[]>().notNull(),
})

export const timelineMetadata = pgTable("timeline_metadata", {
  investigationId: uuid("investigation_id")
    .primaryKey()
    .references(() => investigations.id),
  confidenceScore: numeric("confidence_score", { precision: 3, scale: 2 }),
  evidenceGaps: jsonb("evidence_gaps").$type<string[]>(),
})

export const dissentEntries = pgTable(
  "dissent_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id),
    roundNumber: integer("round_number").notNull(),
    counterArgument: text("counter_argument").notNull(),
    dissentStrength: numeric("dissent_strength", { precision: 3, scale: 2 }).notNull(),
    evidenceCited: jsonb("evidence_cited").$type<JsonValue>().notNull(),
    directorResponse: text("director_response"),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dissentStrengthRange: check(
      "dissent_entries_strength_range",
      sql`${table.dissentStrength} >= 0 and ${table.dissentStrength} <= 1`,
    ),
  }),
)

export const toolCalls = pgTable(
  "tool_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id),
    stepKey: text("step_key").notNull(),
    expertName: text("expert_name").notNull(),
    toolName: text("tool_name").notNull(),
    arguments: jsonb("arguments").$type<JsonValue>().notNull(),
    result: jsonb("result").$type<JsonValue>(),
    error: text("error"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    investigationIdx: index("idx_tool_calls_investigation").on(table.investigationId),
    investigationStepKeyUnique: uniqueIndex("uidx_tool_calls_investigation_step_key").on(
      table.investigationId,
      table.stepKey,
    ),
  }),
)

export const agentOutputs = pgTable(
  "agent_outputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id),
    roundNumber: integer("round_number").notNull(),
    phase: phaseEnum("phase").notNull(),
    agentRole: text("agent_role").notNull(),
    stepKey: text("step_key").notNull(),
    modelAlias: text("model_alias").notNull(),
    modelId: text("model_id").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputSnapshot: jsonb("input_snapshot").$type<JsonValue>().notNull(),
    outputJson: jsonb("output_json").$type<JsonValue>().notNull(),
    validationError: text("validation_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    investigationRoundIdx: index("idx_agent_outputs_investigation_round").on(
      table.investigationId,
      table.roundNumber,
    ),
    investigationStepKeyUnique: uniqueIndex("uidx_agent_outputs_investigation_step_key").on(
      table.investigationId,
      table.stepKey,
    ),
  }),
)

export const investigationEvents = pgTable(
  "investigation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id),
    sequence: bigint("sequence", { mode: "number" }).notNull().generatedAlwaysAsIdentity(),
    eventType: investigationEventTypeEnum("event_type").notNull(),
    payload: jsonb("payload").$type<JsonValue>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    investigationSequenceIdx: index("idx_events_investigation_sequence").on(
      table.investigationId,
      table.sequence,
    ),
    investigationSequenceUnique: uniqueIndex("uidx_events_investigation_sequence").on(
      table.investigationId,
      table.sequence,
    ),
  }),
)

export const llmCalls = pgTable(
  "llm_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => investigations.id),
    agentRole: text("agent_role").notNull(),
    modelAlias: text("model_alias").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    traceId: text("trace_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    inputTokensNonnegative: check(
      "llm_calls_input_tokens_nonnegative",
      sql`${table.inputTokens} >= 0`,
    ),
    outputTokensNonnegative: check(
      "llm_calls_output_tokens_nonnegative",
      sql`${table.outputTokens} >= 0`,
    ),
    costUsdNonnegative: check("llm_calls_cost_usd_nonnegative", sql`${table.costUsd} >= 0`),
    durationMsNonnegative: check(
      "llm_calls_duration_ms_nonnegative",
      sql`${table.durationMs} >= 0`,
    ),
  }),
)
