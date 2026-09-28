import Fastify, { type FastifyInstance } from "fastify"

import type { ArgusConfig } from "@argus/config"
import type {
  AccountsRepository,
  AuthRepository,
  IntegrationsRepository,
  InvestigationsRepository,
} from "@argus/db"
import { createArgusTelemetry } from "@argus/otel"

import { createInvestigationRequestedPublisher } from "./inngest.js"
import { registerAuthRoutes } from "./routes/auth.js"
import {
  type InvestigationRequestedPublisher,
  registerInvestigationRoutes,
} from "./routes/investigations.js"
import { registerWorkspaceAccountRoutes } from "./routes/workspace-account.js"
import { registerWorkspaceApiKeyRoutes } from "./routes/workspace-api-keys.js"
import { registerWorkspaceIntegrationRoutes } from "./routes/workspace-integrations.js"
import { createWriteGuard } from "./security.js"
import { registerErrorHandler } from "./validation.js"

export type BuildApiAppOptions = {
  accounts?: AccountsRepository
  config: ArgusConfig
  auth?: AuthRepository
  integrations?: IntegrationsRepository
  investigations: InvestigationsRepository
  publishInvestigationRequested?: InvestigationRequestedPublisher
}

export function buildApiApp({
  accounts,
  auth,
  config,
  integrations,
  investigations,
  publishInvestigationRequested = createInvestigationRequestedPublisher(config),
}: BuildApiAppOptions): FastifyInstance {
  if (config.runtime.nodeEnv === "production" && !auth) {
    throw new Error("production API requires auth repository")
  }

  const telemetry = createArgusTelemetry(config, "argus-api")
  const app = Fastify({
    bodyLimit: config.api.requestBodyLimitBytes,
    logger: {
      level: config.runtime.logLevel,
    },
  })

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request.headers.origin, reply, config.api.corsOrigin)
    void reply.header("x-argus-request-id", request.id)

    if (request.method === "OPTIONS") {
      return reply.code(204).send()
    }
  })

  registerErrorHandler(app)
  if (auth) {
    registerAuthRoutes(app, auth, config)
    registerWorkspaceApiKeyRoutes(app, auth)
    if (accounts) {
      registerWorkspaceAccountRoutes(app, auth, accounts)
    }
    if (integrations) {
      registerWorkspaceIntegrationRoutes(app, auth, integrations)
    }
  }

  app.get("/health", async () => ({
    ok: true,
    service: "argus-api",
    environment: config.runtime.nodeEnv,
    telemetryEnabled: telemetry.enabled,
  }))

  registerInvestigationRoutes(app, investigations, {
    ...(accounts ? { accounts } : {}),
    ...(auth ? { auth } : {}),
    config,
    publishInvestigationRequested,
    writeGuard: createWriteGuard({
      apiKey: config.api.apiKey,
      rateLimitMax: config.api.rateLimitMax,
      rateLimitWindowMs: config.api.rateLimitWindowMs,
    }),
  })

  return app
}

function applyCorsHeaders(
  requestOrigin: string | undefined,
  reply: { header: (name: string, value: string) => unknown },
  allowedOrigin: string,
): void {
  if (requestOrigin !== allowedOrigin) {
    return
  }

  void reply.header("access-control-allow-origin", allowedOrigin)
  void reply.header("access-control-allow-methods", "DELETE,GET,POST,PUT,OPTIONS")
  void reply.header("access-control-allow-headers", "content-type,authorization,x-api-key")
  void reply.header("vary", "Origin")
}
