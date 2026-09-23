import { describe, expect, it } from "vitest"

import type { ArgusConfig } from "@argus/config"

import { investigationRequestedEventName, investigationRequestedEventSchema } from "./events.js"
import { createArgusInngestClient } from "./inngest.js"

const config: ArgusConfig = {
  runtime: {
    nodeEnv: "test",
    logLevel: "error",
  },
  api: {
    host: "127.0.0.1",
    port: 3001,
    apiKey: "test-api-key",
    publicUrl: "http://localhost:3001",
    rateLimitMax: 60,
    rateLimitWindowMs: 60_000,
    requestBodyLimitBytes: 65_536,
    corsOrigin: "http://localhost:3000",
  },
  auth: {
    bootstrapEmail: "owner@example.com",
    bootstrapPassword: "correct-password",
    bootstrapWorkspaceName: "Example Workspace",
  },
  database: {
    url: "postgres://argus:argus@localhost:5432/argus",
  },
  worker: {
    host: "127.0.0.1",
    port: 3002,
  },
  inngest: {
    eventKey: "test-event-key",
    signingKey: "test-signing-key",
    apiBaseUrl: "http://localhost:8288",
  },
  llm: {
    anthropicApiKey: "test-anthropic-key",
    modelAliases: {
      "director.primary": "director-model",
      "expert.cheap": "expert-model",
      "critic.balanced": "critic-model",
      "counsel.balanced": "counsel-model",
      "reporter.primary": "reporter-model",
    },
  },
  observabilityBackends: {},
  integrations: {},
  otel: {
    serviceName: "argus-worker",
    tracesExporter: "otlp",
    metricsExporter: "otlp",
    logsExporter: "otlp",
  },
}

describe("Inngest client", () => {
  it("creates a Argus Inngest client", () => {
    const client = createArgusInngestClient(config)

    expect(client.id).toBe("argus")
  })

  it("validates investigation requested events", () => {
    const event = investigationRequestedEventSchema.parse({
      id: "01KSCAGHW2FH4KYDK4YE2PX9WD",
      name: investigationRequestedEventName,
      ts: 1779603883906,
      user: {},
      data: {
        investigationId: "11111111-1111-4111-8111-111111111111",
        incidentId: "checkout-latency-2026-05-23",
        triggerPayload: {
          service: "checkout",
        },
      },
    })

    expect(event.name).toBe("investigation.requested")
  })
})
