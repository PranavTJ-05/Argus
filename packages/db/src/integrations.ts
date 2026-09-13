import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

import { and, eq } from "drizzle-orm"

import type { JsonValue } from "@argus/shared-types"

import type { ArgusDatabase } from "./client.js"
import { investigations, workspaceIntegrations } from "./schema.js"

export type IntegrationProvider = "github" | "prometheus" | "loki" | "tempo" | "launchdarkly"

export type WorkspaceIntegrationMetadata = {
  id: string
  workspaceId: string
  provider: IntegrationProvider
  status: "connected" | "disabled"
  config: IntegrationConfig
  hasSecret: boolean
  secretKeyHint: string | null
  createdAt: string
  updatedAt: string
}

export type ResolvedWorkspaceIntegrations = {
  github?: { owner: string; repo: string; token: string }
  launchdarkly?: { token: string }
  loki?: { endpoint: string }
  prometheus?: { endpoint: string }
  tempo?: { endpoint: string }
}

export type IntegrationConfig = { [key: string]: JsonValue }

export type IntegrationsRepository = {
  listWorkspaceIntegrations: (workspaceId: string) => Promise<WorkspaceIntegrationMetadata[]>
  upsertWorkspaceIntegration: (input: {
    workspaceId: string
    provider: IntegrationProvider
    config: IntegrationConfig
    secret?: string | null
  }) => Promise<WorkspaceIntegrationMetadata>
  disableWorkspaceIntegration: (input: {
    workspaceId: string
    provider: IntegrationProvider
  }) => Promise<boolean>
  resolveForInvestigation: (investigationId: string) => Promise<ResolvedWorkspaceIntegrations>
}

export function createIntegrationsRepository(
  db: ArgusDatabase,
  secretKey: string,
): IntegrationsRepository {
  const cipher = createSecretCipher(secretKey)

  return {
    async listWorkspaceIntegrations(workspaceId) {
      const rows = await db
        .select()
        .from(workspaceIntegrations)
        .where(eq(workspaceIntegrations.workspaceId, workspaceId))

      return rows.map(mapIntegrationMetadata)
    },

    async upsertWorkspaceIntegration(input) {
      const encryptedSecret =
        input.secret && input.secret.trim().length > 0 ? cipher.encrypt(input.secret.trim()) : null
      const [row] = await db
        .insert(workspaceIntegrations)
        .values({
          workspaceId: input.workspaceId,
          provider: input.provider,
          status: "connected",
          config: input.config,
          secretCiphertext: encryptedSecret,
          secretKeyHint: input.secret ? createSecretHint(input.secret) : null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [workspaceIntegrations.workspaceId, workspaceIntegrations.provider],
          set: {
            status: "connected",
            config: input.config,
            ...(encryptedSecret
              ? {
                  secretCiphertext: encryptedSecret,
                  secretKeyHint: createSecretHint(input.secret ?? ""),
                }
              : {}),
            updatedAt: new Date(),
          },
        })
        .returning()

      if (!row) {
        throw new Error("failed to save workspace integration")
      }

      return mapIntegrationMetadata(row)
    },

    async disableWorkspaceIntegration(input) {
      const rows = await db
        .update(workspaceIntegrations)
        .set({
          status: "disabled",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workspaceIntegrations.workspaceId, input.workspaceId),
            eq(workspaceIntegrations.provider, input.provider),
          ),
        )
        .returning({ id: workspaceIntegrations.id })

      return rows.length > 0
    },

    async resolveForInvestigation(investigationId) {
      const [workspace] = await db
        .select({ workspaceId: investigations.workspaceId })
        .from(investigations)
        .where(eq(investigations.id, investigationId))
        .limit(1)

      if (!workspace?.workspaceId) {
        return {}
      }

      const rows = await db
        .select()
        .from(workspaceIntegrations)
        .where(
          and(
            eq(workspaceIntegrations.workspaceId, workspace.workspaceId),
            eq(workspaceIntegrations.status, "connected"),
          ),
        )

      const resolved: ResolvedWorkspaceIntegrations = {}

      for (const row of rows) {
        const config = asRecord(row.config)
        const secret = row.secretCiphertext ? cipher.decrypt(row.secretCiphertext) : null

        if (row.provider === "github" && secret) {
          const owner = asString(config.owner)
          const repo = asString(config.repo)
          if (owner && repo) {
            resolved.github = { owner, repo, token: secret }
          }
        }

        if (row.provider === "prometheus") {
          const endpoint = asString(config.endpoint)
          if (endpoint) {
            resolved.prometheus = { endpoint }
          }
        }

        if (row.provider === "loki") {
          const endpoint = asString(config.endpoint)
          if (endpoint) {
            resolved.loki = { endpoint }
          }
        }

        if (row.provider === "tempo") {
          const endpoint = asString(config.endpoint)
          if (endpoint) {
            resolved.tempo = { endpoint }
          }
        }

        if (row.provider === "launchdarkly" && secret) {
          resolved.launchdarkly = { token: secret }
        }
      }

      return resolved
    },
  }
}

function mapIntegrationMetadata(
  row: typeof workspaceIntegrations.$inferSelect,
): WorkspaceIntegrationMetadata {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider,
    status: row.status,
    config: asRecord(row.config),
    hasSecret: row.secretCiphertext !== null,
    secretKeyHint: row.secretKeyHint,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function createSecretCipher(secretKey: string) {
  const key = createHash("sha256").update(secretKey).digest()

  return {
    encrypt(value: string): string {
      const iv = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", key, iv)
      const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
      const authTag = cipher.getAuthTag()
      return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${ciphertext.toString("base64url")}`
    },
    decrypt(value: string): string {
      const [ivRaw, authTagRaw, ciphertextRaw] = value.split(".")
      if (!ivRaw || !authTagRaw || !ciphertextRaw) {
        throw new Error("invalid encrypted integration secret")
      }
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"))
      decipher.setAuthTag(Buffer.from(authTagRaw, "base64url"))
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextRaw, "base64url")),
        decipher.final(),
      ]).toString("utf8")
    },
  }
}

function createSecretHint(secret: string): string {
  return secret.length <= 4 ? "configured" : `...${secret.slice(-4)}`
}

function asRecord(value: unknown): IntegrationConfig {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as IntegrationConfig)
    : {}
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}
