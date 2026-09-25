import type { FastifyInstance } from "fastify"

import type { ArgusConfig } from "@argus/config"
import type { AccountsRepository, AuthRepository } from "@argus/db"
import type { InvestigationsRepository } from "@argus/db"
import {
  createInvestigationRequestSchema,
  investigationArtifactsSchema,
  investigationListSchema,
  investigationReportSchema,
  investigationSummarySchema,
  toolCallArtifactSchema,
  uuidSchema,
} from "@argus/shared-types"
import { z } from "zod"

import { type RouteGuard, getPresentedApiKey, hasApiKey } from "../security.js"
import { hashSecretToken } from "../tokens.js"
import { parseRequestPart } from "../validation.js"
import { getSessionFromRequest } from "./auth.js"

export type InvestigationRequestedPublisher = (input: {
  investigationId: string
  incidentId: string
  triggerPayload: unknown
}) => Promise<void>

const investigationParamsSchema = z
  .object({
    id: uuidSchema,
  })
  .strict()

const toolCallParamsSchema = z
  .object({
    id: uuidSchema,
    toolCallId: uuidSchema,
  })
  .strict()

const eventsQuerySchema = z
  .object({
    after: z.coerce.number().int().nonnegative().optional(),
  })
  .strict()

export function registerInvestigationRoutes(
  app: FastifyInstance,
  investigations: InvestigationsRepository,
  options: {
    accounts?: AccountsRepository
    auth?: AuthRepository
    config?: ArgusConfig
    publishInvestigationRequested: InvestigationRequestedPublisher
    writeGuard: RouteGuard
  },
): void {
  const accountRateLimitBuckets = new Map<string, RateLimitBucket>()

  app.post(
    "/investigations",
    {
      preHandler: (request, reply) => requireWriteAccess(request, reply, options),
    },
    async (request, reply) => {
      const body = parseRequestPart(createInvestigationRequestSchema, request.body)
      const workspaceId = await resolveWorkspaceId(request, reply, options)

      if (reply.sent) {
        return reply
      }

      await enforceAccountCanCreateInvestigations(workspaceId, reply, options)

      if (reply.sent) {
        return reply
      }

      enforceAccountRateLimit(request, reply, workspaceId, accountRateLimitBuckets, options)

      if (reply.sent) {
        return reply
      }

      const investigation = await investigations.create({
        incidentId: body.incidentId,
        workspaceId,
        triggerPayload: body.triggerPayload ?? {},
      })
      await options.publishInvestigationRequested({
        investigationId: investigation.id,
        incidentId: investigation.incidentId,
        triggerPayload: body.triggerPayload ?? {},
      })
      const responseBody = investigationSummarySchema.parse(investigation)

      return reply.code(201).send(responseBody)
    },
  )

  app.get("/investigations", async (request, reply) => {
    const workspaceId = await resolveWorkspaceId(request, reply, options)

    if (reply.sent) {
      return reply
    }

    return investigationListSchema.parse(await investigations.list(workspaceId))
  })

  app.get("/investigations/:id", async (request, reply) => {
    const params = parseRequestPart(investigationParamsSchema, request.params)
    const workspaceId = await resolveWorkspaceId(request, reply, options)

    if (reply.sent) {
      return reply
    }

    const investigation = await investigations.getById(params.id, workspaceId)

    if (!investigation) {
      return reply.code(404).send({
        error: "not_found",
        message: "investigation not found",
      })
    }

    return investigationSummarySchema.parse(investigation)
  })

  app.post(
    "/investigations/:id/cancel",
    {
      preHandler: (request, reply) => requireWriteAccess(request, reply, options),
    },
    async (request, reply) => {
      const params = parseRequestPart(investigationParamsSchema, request.params)
      const workspaceId = await resolveWorkspaceId(request, reply, options)

      if (reply.sent) {
        return reply
      }

      const investigation = await investigations.getById(params.id, workspaceId)

      if (!investigation) {
        return reply.code(404).send({
          error: "not_found",
          message: "investigation not found",
        })
      }

      if (investigation.status !== "running") {
        return reply.code(409).send({
          error: "invalid_state",
          message: "only running investigations can be cancelled",
          status: investigation.status,
        })
      }

      const cancelled = await investigations.cancelInvestigation(params.id)
      await investigations.appendEvent({
        eventType: "phase_changed",
        investigationId: params.id,
        payload: {
          from: investigation.currentPhase,
          reason: "operator_cancelled",
          to: "done",
        },
      })

      return investigationSummarySchema.parse(cancelled)
    },
  )

  app.get("/investigations/:id/artifacts", async (request, reply) => {
    const params = parseRequestPart(investigationParamsSchema, request.params)
    const workspaceId = await resolveWorkspaceId(request, reply, options)

    if (reply.sent) {
      return reply
    }

    const artifacts = await investigations.getArtifacts(params.id, workspaceId)

    if (!artifacts) {
      return reply.code(404).send({
        error: "not_found",
        message: "investigation not found",
      })
    }

    return investigationArtifactsSchema.parse(artifacts)
  })

  app.get("/investigations/:id/report", async (request, reply) => {
    const params = parseRequestPart(investigationParamsSchema, request.params)
    const workspaceId = await resolveWorkspaceId(request, reply, options)

    if (reply.sent) {
      return reply
    }

    const report = await investigations.getReport(params.id, workspaceId)

    if (!report) {
      return reply.code(404).send({
        error: "not_found",
        message: "investigation not found",
      })
    }

    return investigationReportSchema.parse(report)
  })

  app.get("/investigations/:id/tool-calls/:toolCallId", async (request, reply) => {
    const params = parseRequestPart(toolCallParamsSchema, request.params)
    const workspaceId = await resolveWorkspaceId(request, reply, options)

    if (reply.sent) {
      return reply
    }

    const toolCall = await investigations.getToolCall(params.id, params.toolCallId, workspaceId)

    if (!toolCall) {
      return reply.code(404).send({
        error: "not_found",
        message: "tool call not found",
      })
    }

    return toolCallArtifactSchema.parse(toolCall)
  })

  app.get("/investigations/:id/events", async (request, reply) => {
    const params = parseRequestPart(investigationParamsSchema, request.params)
    const query = parseRequestPart(eventsQuerySchema, request.query)
    const lastEventId = parseLastEventId(request.headers["last-event-id"])
    const after = query.after ?? lastEventId ?? 0
    const workspaceId = await resolveWorkspaceId(request, reply, options)

    if (reply.sent) {
      return reply
    }

    const events = await investigations.getEventsAfter(params.id, after, workspaceId)

    if (!events) {
      return reply.code(404).send({
        error: "not_found",
        message: "investigation not found",
      })
    }

    reply.raw.writeHead(200, {
      "cache-control": "no-cache",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
    })

    for (const event of events) {
      reply.raw.write(`id: ${event.sequence}\n`)
      reply.raw.write(`event: ${event.eventType}\n`)
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    reply.raw.end()
  })
}

async function resolveWorkspaceId(
  request: Parameters<RouteGuard>[0],
  reply: Parameters<RouteGuard>[1],
  options: {
    auth?: AuthRepository
    config?: ArgusConfig
  },
): Promise<string | null> {
  if (!options.auth || !options.config) {
    return null
  }

  const session = await getSessionFromRequest(options.auth, request)

  if (session) {
    return session.workspace.id
  }

  const workspaceApiKey = await resolveWorkspaceApiKey(request, options.auth)

  if (workspaceApiKey) {
    return workspaceApiKey.workspaceId
  }

  if (
    options.config.runtime.nodeEnv !== "production" &&
    hasApiKey(request, options.config.api.apiKey)
  ) {
    const bootstrap = await options.auth.ensureBootstrapUser({
      email: options.config.auth.bootstrapEmail,
      workspaceName: options.config.auth.bootstrapWorkspaceName,
    })

    return bootstrap.workspace.id
  }

  void reply.code(401).send({
    error: "unauthorized",
    message: "missing or invalid session",
  })
  return null
}

async function requireWriteAccess(
  request: Parameters<RouteGuard>[0],
  reply: Parameters<RouteGuard>[1],
  options: {
    auth?: AuthRepository
    config?: ArgusConfig
    writeGuard: RouteGuard
  },
): Promise<void> {
  if (options.auth) {
    const session = await getSessionFromRequest(options.auth, request)

    if (session) {
      return
    }

    const workspaceApiKey = await resolveWorkspaceApiKey(request, options.auth)

    if (workspaceApiKey) {
      return
    }

    if (options.config?.runtime.nodeEnv === "production") {
      void reply.code(401).send({
        error: "unauthorized",
        message: "missing or invalid workspace API key",
      })
      return
    }
  }

  await options.writeGuard(request, reply)
}

type RateLimitBucket = {
  count: number
  resetAt: number
}

async function enforceAccountCanCreateInvestigations(
  workspaceId: string | null,
  reply: Parameters<RouteGuard>[1],
  options: {
    accounts?: AccountsRepository
  },
): Promise<void> {
  if (!workspaceId || !options.accounts) {
    return
  }

  const account = await options.accounts.getWorkspaceAccount(workspaceId)

  if (!account) {
    void reply.code(403).send({
      error: "workspace_unavailable",
      message: "workspace account is unavailable",
    })
    return
  }

  if (account.status === "active") {
    return
  }

  void reply.code(403).send({
    error: "workspace_not_active",
    message:
      account.status === "suspended"
        ? "workspace is suspended; historical reads remain available"
        : "workspace is disabled; operator review is required",
    status: account.status,
  })
}

function enforceAccountRateLimit(
  request: Parameters<RouteGuard>[0],
  reply: Parameters<RouteGuard>[1],
  workspaceId: string | null,
  buckets: Map<string, RateLimitBucket>,
  options: {
    config?: ArgusConfig
  },
): void {
  if (!workspaceId || !options.config) {
    return
  }

  const token = getPresentedApiKey(request)
  const identity = token ? `api-key:${hashSecretToken(token)}` : `workspace:${workspaceId}`
  const route = request.routeOptions.url ?? request.url
  const bucketKey = `${identity}:${route}`
  const now = Date.now()
  const existing = buckets.get(bucketKey)
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : {
          count: 0,
          resetAt: now + options.config.api.rateLimitWindowMs,
        }

  bucket.count += 1
  buckets.set(bucketKey, bucket)

  const remaining = Math.max(options.config.api.rateLimitMax - bucket.count, 0)
  const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1)

  void reply.header("x-workspace-ratelimit-limit", options.config.api.rateLimitMax)
  void reply.header("x-workspace-ratelimit-remaining", remaining)
  void reply.header("x-workspace-ratelimit-reset", Math.ceil(bucket.resetAt / 1000))

  if (bucket.count > options.config.api.rateLimitMax) {
    void reply.code(429).send({
      error: "rate_limit_exceeded",
      message: "workspace rate limit exceeded",
      retryAfterSeconds,
    })
  }
}

async function resolveWorkspaceApiKey(
  request: Parameters<RouteGuard>[0],
  auth: AuthRepository,
): Promise<{ keyId: string; workspaceId: string } | null> {
  const token = getPresentedApiKey(request)

  if (!token) {
    return null
  }

  return auth.getWorkspaceByApiKeyHash(hashSecretToken(token))
}

function parseLastEventId(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) {
    return undefined
  }

  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined
}
