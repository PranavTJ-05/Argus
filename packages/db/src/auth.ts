import { and, eq, gt, isNull } from "drizzle-orm"

import type { ArgusDatabase } from "./client.js"
import {
  authSessions,
  users,
  workspaceApiKeys,
  workspaceMemberships,
  workspaces,
} from "./schema.js"

export type AuthUser = {
  id: string
  email: string
  displayName: string
}

export type LoginUser = AuthUser & {
  passwordHash: string | null
}

export type AuthWorkspace = {
  id: string
  name: string
  slug: string
  role: "admin" | "engineer" | "viewer"
}

export type AuthSession = {
  id: string
  user: AuthUser
  workspace: AuthWorkspace
  expiresAt: string
}

export type WorkspaceApiKeyMetadata = {
  id: string
  workspaceId: string
  name: string
  keyPrefix: string
  status: "active" | "revoked"
  lastUsedAt: string | null
  createdAt: string
  revokedAt: string | null
}

export type AuthRepository = {
  createWorkspaceOwner: (input: {
    email: string
    displayName?: string
    passwordHash: string
    workspaceName: string
  }) => Promise<{ user: AuthUser; workspace: AuthWorkspace }>
  ensureBootstrapUser: (input: {
    email: string
    workspaceName: string
  }) => Promise<{ user: AuthUser; workspace: AuthWorkspace }>
  getLoginUserByEmail: (email: string) => Promise<LoginUser | null>
  createSession: (input: {
    userId: string
    tokenHash: string
    expiresAt: Date
  }) => Promise<AuthSession>
  getSessionByTokenHash: (tokenHash: string, now?: Date) => Promise<AuthSession | null>
  deleteSessionByTokenHash: (tokenHash: string) => Promise<void>
  createWorkspaceApiKey: (input: {
    workspaceId: string
    userId: string
    name: string
    keyHash: string
    keyPrefix: string
  }) => Promise<WorkspaceApiKeyMetadata>
  listWorkspaceApiKeys: (workspaceId: string) => Promise<WorkspaceApiKeyMetadata[]>
  getWorkspaceByApiKeyHash: (
    keyHash: string,
    now?: Date,
  ) => Promise<{ keyId: string; workspaceId: string } | null>
  revokeWorkspaceApiKey: (input: { workspaceId: string; keyId: string }) => Promise<boolean>
}

export function createAuthRepository(db: ArgusDatabase): AuthRepository {
  return {
    async createWorkspaceOwner(input) {
      const email = input.email.trim().toLowerCase()
      const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1)

      if (existingUser) {
        throw new Error("user already exists")
      }

      const [user] = await db
        .insert(users)
        .values({
          email,
          displayName: input.displayName?.trim() || displayNameFromEmail(email),
          passwordHash: input.passwordHash,
        })
        .returning()

      if (!user) {
        throw new Error("failed to create user")
      }

      const workspaceSlug = await createAvailableWorkspaceSlug(db, input.workspaceName)
      const [workspace] = await db
        .insert(workspaces)
        .values({
          name: input.workspaceName,
          slug: workspaceSlug,
        })
        .returning()

      if (!workspace) {
        throw new Error("failed to create workspace")
      }

      const [membership] = await db
        .insert(workspaceMemberships)
        .values({
          workspaceId: workspace.id,
          userId: user.id,
          role: "admin",
        })
        .returning()

      if (!membership) {
        throw new Error("failed to create workspace membership")
      }

      return {
        user: mapUser(user),
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          role: membership.role,
        },
      }
    },

    async ensureBootstrapUser(input) {
      const email = input.email.trim().toLowerCase()
      const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1)
      const user =
        existingUser ??
        (
          await db
            .insert(users)
            .values({
              email,
              displayName: displayNameFromEmail(email),
            })
            .returning()
        )[0]

      if (!user) {
        throw new Error("failed to create bootstrap user")
      }

      const workspaceSlug = slugify(input.workspaceName)
      const [existingWorkspace] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.slug, workspaceSlug))
        .limit(1)
      const workspace =
        existingWorkspace ??
        (
          await db
            .insert(workspaces)
            .values({
              name: input.workspaceName,
              slug: workspaceSlug,
            })
            .returning()
        )[0]

      if (!workspace) {
        throw new Error("failed to create bootstrap workspace")
      }

      const [existingMembership] = await db
        .select()
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, workspace.id),
            eq(workspaceMemberships.userId, user.id),
          ),
        )
        .limit(1)

      const membership =
        existingMembership ??
        (
          await db
            .insert(workspaceMemberships)
            .values({
              workspaceId: workspace.id,
              userId: user.id,
              role: "admin",
            })
            .returning()
        )[0]

      if (!membership) {
        throw new Error("failed to create bootstrap workspace membership")
      }

      return {
        user: mapUser(user),
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          role: membership.role,
        },
      }
    },

    async getLoginUserByEmail(email) {
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.trim().toLowerCase()))
        .limit(1)

      return row
        ? {
            ...mapUser(row),
            passwordHash: row.passwordHash,
          }
        : null
    },

    async createSession(input) {
      const [session] = await db
        .insert(authSessions)
        .values({
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        })
        .returning()

      if (!session) {
        throw new Error("failed to create auth session")
      }

      const authSession = await this.getSessionByTokenHash(input.tokenHash, new Date(0))

      if (!authSession) {
        throw new Error("failed to load auth session")
      }

      return authSession
    },

    async getSessionByTokenHash(tokenHash, now = new Date()) {
      const [row] = await db
        .select({
          sessionId: authSessions.id,
          expiresAt: authSessions.expiresAt,
          userId: users.id,
          email: users.email,
          displayName: users.displayName,
          workspaceId: workspaces.id,
          workspaceName: workspaces.name,
          workspaceSlug: workspaces.slug,
          role: workspaceMemberships.role,
        })
        .from(authSessions)
        .innerJoin(users, eq(authSessions.userId, users.id))
        .innerJoin(workspaceMemberships, eq(workspaceMemberships.userId, users.id))
        .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
        .where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, now)))
        .limit(1)

      if (!row) {
        return null
      }

      return {
        id: row.sessionId,
        user: {
          id: row.userId,
          email: row.email,
          displayName: row.displayName,
        },
        workspace: {
          id: row.workspaceId,
          name: row.workspaceName,
          slug: row.workspaceSlug,
          role: row.role,
        },
        expiresAt: row.expiresAt.toISOString(),
      }
    },

    async deleteSessionByTokenHash(tokenHash) {
      await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash))
    },

    async createWorkspaceApiKey(input) {
      const [apiKey] = await db
        .insert(workspaceApiKeys)
        .values({
          workspaceId: input.workspaceId,
          createdByUserId: input.userId,
          name: input.name,
          keyHash: input.keyHash,
          keyPrefix: input.keyPrefix,
        })
        .returning()

      if (!apiKey) {
        throw new Error("failed to create workspace API key")
      }

      return mapWorkspaceApiKey(apiKey)
    },

    async listWorkspaceApiKeys(workspaceId) {
      const rows = await db
        .select()
        .from(workspaceApiKeys)
        .where(eq(workspaceApiKeys.workspaceId, workspaceId))

      return rows.map(mapWorkspaceApiKey)
    },

    async getWorkspaceByApiKeyHash(keyHash, now = new Date()) {
      const [row] = await db
        .select({
          id: workspaceApiKeys.id,
          workspaceId: workspaceApiKeys.workspaceId,
        })
        .from(workspaceApiKeys)
        .where(
          and(
            eq(workspaceApiKeys.keyHash, keyHash),
            eq(workspaceApiKeys.status, "active"),
            isNull(workspaceApiKeys.revokedAt),
          ),
        )
        .limit(1)

      if (!row) {
        return null
      }

      await db
        .update(workspaceApiKeys)
        .set({ lastUsedAt: now })
        .where(eq(workspaceApiKeys.id, row.id))

      return {
        keyId: row.id,
        workspaceId: row.workspaceId,
      }
    },

    async revokeWorkspaceApiKey(input) {
      const rows = await db
        .update(workspaceApiKeys)
        .set({
          status: "revoked",
          revokedAt: new Date(),
        })
        .where(
          and(
            eq(workspaceApiKeys.id, input.keyId),
            eq(workspaceApiKeys.workspaceId, input.workspaceId),
            eq(workspaceApiKeys.status, "active"),
          ),
        )
        .returning({ id: workspaceApiKeys.id })

      return rows.length > 0
    },
  }
}

function mapUser(row: typeof users.$inferSelect): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
  }
}

function displayNameFromEmail(email: string): string {
  return email.split("@")[0]?.replace(/[._-]+/g, " ") || "Argus User"
}

function mapWorkspaceApiKey(row: typeof workspaceApiKeys.$inferSelect): WorkspaceApiKeyMetadata {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    status: row.status,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  return slug || "argus-workspace"
}

async function createAvailableWorkspaceSlug(
  db: ArgusDatabase,
  workspaceName: string,
): Promise<string> {
  const baseSlug = slugify(workspaceName)
  const [existing] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, baseSlug))
    .limit(1)

  if (!existing) {
    return baseSlug
  }

  return `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`
}
