import { describe, expect, it } from "vitest"

import type { ArgusConfig } from "@argus/config"

import { createArgusTelemetry } from "./index.js"

describe("Argus telemetry", () => {
  it("builds stable service metadata from config", () => {
    const telemetry = createArgusTelemetry(config(), "argus-worker")

    expect(telemetry).toEqual({
      enabled: true,
      logsExporter: "otlp",
      metricsExporter: "otlp",
      resourceAttributes: {
        "deployment.environment": "test",
        "service.name": "argus-worker",
      },
      serviceName: "argus-worker",
      tracesExporter: "otlp",
    })
  })
})

function config(): ArgusConfig {
  return {
    api: {
      apiKey: "test-api-key",
      host: "127.0.0.1",
      port: 3001,
      publicUrl: "http://localhost:3001",
      rateLimitMax: 60,
      rateLimitWindowMs: 60_000,
      requestBodyLimitBytes: 65_536,
      corsOrigin: "http://localhost:3000",
    },
    database: {
      url: "postgres://argus:argus@localhost:5432/argus",
    },
    worker: {
      host: "127.0.0.1",
      port: 3002,
    },
    inngest: {
      apiBaseUrl: "http://localhost:8288",
      eventKey: "test-event-key",
      signingKey: "test-signing-key",
    },
    integrations: {},
    llm: {
      anthropicApiKey: "test-key",
      modelAliases: {
        "counsel.balanced": "counsel-model",
        "critic.balanced": "critic-model",
        "director.primary": "director-model",
        "expert.cheap": "expert-model",
        "reporter.primary": "reporter-model",
      },
    },
    observabilityBackends: {},
    otel: {
      exporterOtlpEndpoint: "http://localhost:4318",
      logsExporter: "otlp",
      metricsExporter: "otlp",
      serviceName: "argus",
      tracesExporter: "otlp",
    },
    runtime: {
      logLevel: "error",
      nodeEnv: "test",
    },
  }
}
