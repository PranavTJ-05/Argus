import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import type { AuthRepository, IntegrationsRepository } from "@argus/db"
import { jsonValueSchema } from "@argus/shared-types"

import { parseRequestPart } from "../validation.js"
import { getSessionFromRequest } from "./auth.js"

const providerSchema = z.enum(["github", "prometheus", "loki", "tempo", "launchdarkly"])

const integrationParamsSchema = z
  .object({
    provider: providerSchema,
  })
  .strict()

const upsertIntegrationSchema = z
  .object({
    config: z.record(jsonValueSchema).default({}),
    secret: z.string().optional(),
  })
  .strict()

export function registerWorkspaceIntegrationRoutes(
  app: FastifyInstance,
  auth: AuthRepository,
  integrations: IntegrationsRepository,
): void {
  app.get("/workspace/integrations", async (request, reply) => {
    const session = await requireSession(auth, request, reply)

    if (!session) {
      return reply
    }

    return integrations.listWorkspaceIntegrations(session.workspace.id)
  })

  app.put("/workspace/integrations/:provider", async (request, reply) => {
    const session = await requireSession(auth, request, reply)

    if (!session) {
      return reply
    }

    const params = parseRequestPart(integrationParamsSchema, request.params)
    const body = parseRequestPart(upsertIntegrationSchema, request.body ?? {})
    const integration = await integrations.upsertWorkspaceIntegration({
      workspaceId: session.workspace.id,
      provider: params.provider,
      config: body.config ?? {},
      ...(body.secret !== undefined ? { secret: body.secret } : {}),
    })

    return reply.code(200).send(integration)
  })

  app.delete("/workspace/integrations/:provider", async (request, reply) => {
    const session = await requireSession(auth, request, reply)

    if (!session) {
      return reply
    }

    const params = parseRequestPart(integrationParamsSchema, request.params)
    const disabled = await integrations.disableWorkspaceIntegration({
      workspaceId: session.workspace.id,
      provider: params.provider,
    })

    if (!disabled) {
      return reply.code(404).send({
        error: "not_found",
        message: "integration not found",
      })
    }

    return {
      ok: true,
    }
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
      message: "viewer users cannot manage integrations",
    })
    return null
  }

  return session
}
