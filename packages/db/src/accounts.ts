import { and, count, eq, sql } from "drizzle-orm"

import type { ArgusDatabase } from "./client.js"
import { investigations, llmCalls, workspaces } from "./schema.js"

export type WorkspaceStatus = "active" | "suspended" | "disabled"

export type WorkspaceAccount = {
  id: string
  name: string
  slug: string
  status: WorkspaceStatus
  createdAt: string
  updatedAt: string
}

export type WorkspaceUsage = {
  workspaceId: string
  investigationCount: number
  runningInvestigationCount: number
  completedInvestigationCount: number
  failedInvestigationCount: number
  cancelledInvestigationCount: number
  inputTokens: number
  outputTokens: number
  totalCostUsd: number
  totalLlmDurationMs: number
  averageWorkflowLatencyMs: number | null
}

export type AccountsRepository = {
  getWorkspaceAccount: (workspaceId: string) => Promise<WorkspaceAccount | null>
  setWorkspaceStatus: (input: {
    workspaceId: string
    status: WorkspaceStatus
  }) => Promise<WorkspaceAccount | null>
  getWorkspaceUsage: (workspaceId: string) => Promise<WorkspaceUsage>
}

export function createAccountsRepository(db: ArgusDatabase): AccountsRepository {
  return {
    async getWorkspaceAccount(workspaceId) {
      const [row] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1)

      return row ? mapWorkspaceAccount(row) : null
    },

    async setWorkspaceStatus(input) {
      const [row] = await db
        .update(workspaces)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, input.workspaceId))
        .returning()

      return row ? mapWorkspaceAccount(row) : null
    },

    async getWorkspaceUsage(workspaceId) {
      const [investigationUsage] = await db
        .select({
          investigationCount: count(),
          runningInvestigationCount: sql<number>`coalesce(sum(case when ${investigations.status} = 'running' then 1 else 0 end), 0)::int`,
          completedInvestigationCount: sql<number>`coalesce(sum(case when ${investigations.status} = 'completed' then 1 else 0 end), 0)::int`,
          failedInvestigationCount: sql<number>`coalesce(sum(case when ${investigations.status} = 'failed' then 1 else 0 end), 0)::int`,
          cancelledInvestigationCount: sql<number>`coalesce(sum(case when ${investigations.status} = 'cancelled' then 1 else 0 end), 0)::int`,
          averageWorkflowLatencyMs: sql<
            number | null
          >`round(avg(extract(epoch from (${investigations.updatedAt} - ${investigations.createdAt})) * 1000) filter (where ${investigations.status} <> 'running'))::int`,
        })
        .from(investigations)
        .where(eq(investigations.workspaceId, workspaceId))

      const [llmUsage] = await db
        .select({
          inputTokens: sql<number>`coalesce(sum(${llmCalls.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${llmCalls.outputTokens}), 0)::int`,
          totalCostUsd: sql<string>`coalesce(sum(${llmCalls.costUsd}), 0)::text`,
          totalLlmDurationMs: sql<number>`coalesce(sum(${llmCalls.durationMs}), 0)::int`,
        })
        .from(llmCalls)
        .innerJoin(investigations, eq(llmCalls.investigationId, investigations.id))
        .where(
          and(
            eq(investigations.workspaceId, workspaceId),
            eq(llmCalls.investigationId, investigations.id),
          ),
        )

      return {
        workspaceId,
        investigationCount: investigationUsage?.investigationCount ?? 0,
        runningInvestigationCount: investigationUsage?.runningInvestigationCount ?? 0,
        completedInvestigationCount: investigationUsage?.completedInvestigationCount ?? 0,
        failedInvestigationCount: investigationUsage?.failedInvestigationCount ?? 0,
        cancelledInvestigationCount: investigationUsage?.cancelledInvestigationCount ?? 0,
        inputTokens: llmUsage?.inputTokens ?? 0,
        outputTokens: llmUsage?.outputTokens ?? 0,
        totalCostUsd: Number(llmUsage?.totalCostUsd ?? 0),
        totalLlmDurationMs: llmUsage?.totalLlmDurationMs ?? 0,
        averageWorkflowLatencyMs: investigationUsage?.averageWorkflowLatencyMs ?? null,
      }
    },
  }
}

function mapWorkspaceAccount(row: typeof workspaces.$inferSelect): WorkspaceAccount {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
