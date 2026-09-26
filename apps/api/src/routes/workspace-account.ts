import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import type { AccountsRepository, AuthRepository } from "@argus/db"

import { parseRequestPart } from "../validation.js"
import { getSessionFromRequest } from "./auth.js"

const workspaceStatusSchema = z.enum(["active", "suspended", "disabled"])

const updateWorkspaceAccountSchema = z
  .object({
    status: workspaceStatusSchema,
  })
  .strict()

export function registerWorkspaceAccountRoutes(
  app: FastifyInstance,
  auth: AuthRepository,
  accounts: AccountsRepository,
): void {
  app.get("/workspace/account", async (request, reply) => {
    const session = await requireSession(auth, request, reply)

    if (!session) {
      return reply
    }

    const [account, usage] = await Promise.all([
      accounts.getWorkspaceAccount(session.workspace.id),
      accounts.getWorkspaceUsage(session.workspace.id),
    ])

    if (!account) {
      return reply.code(404).send({
        error: "not_found",
        message: "workspace not found",
      })
    }

    return {
      account,
      usage,
      policy: {
        active: "workspace can create and read investigations",
        suspended: "workspace cannot create investigations but can read historical data",
        disabled: "workspace cannot create new investigations; operator review required",
      },
    }
  })

  app.put("/workspace/account", async (request, reply) => {
    const session = await requireSession(auth, request, reply)

    if (!session) {
      return reply
    }

    if (session.workspace.role !== "admin") {
      return reply.code(403).send({
        error: "forbidden",
        message: "only workspace admins can change account status",
      })
    }

    const body = parseRequestPart(updateWorkspaceAccountSchema, request.body ?? {})
    const account = await accounts.setWorkspaceStatus({
      workspaceId: session.workspace.id,
      status: body.status,
    })

    if (!account) {
      return reply.code(404).send({
        error: "not_found",
        message: "workspace not found",
      })
    }

    return account
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

  return session
}
