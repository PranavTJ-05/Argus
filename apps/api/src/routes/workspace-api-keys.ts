import { randomBytes } from "node:crypto"

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import type { AuthRepository } from "@argus/db"
import { uuidSchema } from "@argus/shared-types"

import { hashSecretToken } from "../tokens.js"
import { parseRequestPart } from "../validation.js"
import { getSessionFromRequest } from "./auth.js"

const createApiKeyRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80).default("Default integration key"),
  })
  .strict()

const apiKeyParamsSchema = z
  .object({
    id: uuidSchema,
  })
  .strict()

export function registerWorkspaceApiKeyRoutes(app: FastifyInstance, auth: AuthRepository): void {
  app.get("/workspace/api-keys", async (request, reply) => {
    const session = await requireSession(auth, request, reply)

    if (!session) {
      return reply
    }

    return auth.listWorkspaceApiKeys(session.workspace.id)
  })

  app.post("/workspace/api-keys", async (request, reply) => {
    const session = await requireSession(auth, request, reply)

    if (!session) {
      return reply
    }

    const body = parseRequestPart(createApiKeyRequestSchema, request.body ?? {})
    const name = body.name ?? "Default integration key"
    const rawKey = generateWorkspaceApiKey()
    const key = await auth.createWorkspaceApiKey({
      workspaceId: session.workspace.id,
      userId: session.user.id,
      name,
      keyHash: hashSecretToken(rawKey),
      keyPrefix: createKeyPrefix(rawKey),
    })

    return reply.code(201).send({
      apiKey: rawKey,
      key,
    })
  })

  app.post("/workspace/api-keys/:id/revoke", async (request, reply) => {
    const session = await requireSession(auth, request, reply)

    if (!session) {
      return reply
    }

    const params = parseRequestPart(apiKeyParamsSchema, request.params)
    const revoked = await auth.revokeWorkspaceApiKey({
      workspaceId: session.workspace.id,
      keyId: params.id,
    })

    if (!revoked) {
      return reply.code(404).send({
        error: "not_found",
        message: "API key not found",
      })
    }

    return {
      ok: true,
    }
  })

  app.post("/workspace/api-keys/:id/rotate", async (request, reply) => {
    const session = await requireSession(auth, request, reply)

    if (!session) {
      return reply
    }

    const params = parseRequestPart(apiKeyParamsSchema, request.params)
    const existing = (await auth.listWorkspaceApiKeys(session.workspace.id)).find(
      (key) => key.id === params.id && key.status === "active",
    )

    if (!existing) {
      return reply.code(404).send({
        error: "not_found",
        message: "API key not found",
      })
    }

    await auth.revokeWorkspaceApiKey({
      workspaceId: session.workspace.id,
      keyId: params.id,
    })

    const rawKey = generateWorkspaceApiKey()
    const key = await auth.createWorkspaceApiKey({
      workspaceId: session.workspace.id,
      userId: session.user.id,
      name: existing.name,
      keyHash: hashSecretToken(rawKey),
      keyPrefix: createKeyPrefix(rawKey),
    })

    return reply.code(201).send({
      apiKey: rawKey,
      key,
      revokedKeyId: params.id,
    })
  })
}

async function requireSession(
  auth: AuthRepository,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<Awaited<ReturnType<AuthRepository["getSessionByTokenHash"]>>> {
  const session = await getSessionFromRequest(auth, request)

  if (!session) {
    void reply.code(401).send({
      error: "unauthorized",
      message: "missing or invalid session",
    })
    return null
  }

  if (session.workspace.role === "viewer") {
    void reply.code(403).send({
      error: "forbidden",
      message: "viewer users cannot manage API keys",
    })
    return null
  }

  return session
}

function generateWorkspaceApiKey(): string {
  return `tc_live_${randomBytes(32).toString("base64url")}`
}

function createKeyPrefix(apiKey: string): string {
  return `${apiKey.slice(0, 15)}...`
}
