import { describe, expect, it } from "vitest"

import { loadArgusConfig, modelAliasConfigSchema } from "./index.js"

const validEnv = {
  NODE_ENV: "development",
  LOG_LEVEL: "debug",
  API_HOST: "0.0.0.0",
  API_PORT: "3001",
  API_KEY: "dev_shared_api_key",
  API_CORS_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_API_URL: "http://localhost:3001",
  DATABASE_URL: "postgres://argus:argus@localhost:5432/argus",
  INNGEST_EVENT_KEY: "local_event_key",
  INNGEST_SIGNING_KEY: "local_signing_key",
  INNGEST_BASE_URL: "http://localhost:8288",
  ANTHROPIC_API_KEY: "test_anthropic_key",
  MODEL_DIRECTOR_PRIMARY: "claude-director",
  MODEL_EXPERT_CHEAP: "claude-expert",
  MODEL_CRITIC_BALANCED: "claude-critic",
  MODEL_COUNSEL_BALANCED: "claude-counsel",
  MODEL_REPORTER_PRIMARY: "claude-reporter",
  TEMPO_ENDPOINT: "http://localhost:3200",
  LOKI_ENDPOINT: "http://localhost:3100",
  PROMETHEUS_ENDPOINT: "http://localhost:9090",
  GRAFANA_ENDPOINT: "http://localhost:3000",
  OTEL_SERVICE_NAME: "argus",
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
  OTEL_TRACES_EXPORTER: "otlp",
  OTEL_METRICS_EXPORTER: "otlp",
  OTEL_LOGS_EXPORTER: "otlp",
}

describe("config loader", () => {
  it("loads structured config from raw env", () => {
    const config = loadArgusConfig(validEnv)

    expect(config.api.port).toBe(3001)
    expect(config.api.rateLimitMax).toBe(60)
    expect(config.api.requestBodyLimitBytes).toBe(65_536)
    expect(config.api.corsOrigin).toBe("http://localhost:3000")
    expect(config.auth.bootstrapEmail).toBe("owner@argus.local")
    expect(config.auth.integrationSecretKey).toBe("dev_integration_secret_key_change_me")
    expect(config.worker.port).toBe(3002)
    expect(config.llm.modelAliases["director.primary"]).toBe("claude-director")
    expect(config.observabilityBackends.tempoEndpoint).toBe("http://localhost:3200")
  })

  it("rejects missing required platform secrets", () => {
    const { ANTHROPIC_API_KEY: _removed, ...envWithoutAnthropic } = validEnv

    expect(() => loadArgusConfig(envWithoutAnthropic)).toThrow()
  })

  it("defaults local development values except the provider API key", () => {
    const config = loadArgusConfig({
      ANTHROPIC_API_KEY: "test_anthropic_key",
      SHELL: "/bin/zsh",
    })

    expect(config.api.apiKey).toBe("dev_shared_api_key")
    expect(config.auth.bootstrapWorkspaceName).toBe("Argus Workspace")
    expect(config.database.url).toContain("localhost:5432")
    expect(config.llm.modelAliases["director.primary"]).toBe("claude-sonnet-4-6")
  })

  it("validates all required model aliases", () => {
    const result = modelAliasConfigSchema.safeParse({
      "director.primary": "claude-director",
      "expert.cheap": "claude-expert",
      "critic.balanced": "claude-critic",
      "counsel.balanced": "claude-counsel",
      "reporter.primary": "claude-reporter",
    })

    expect(result.success).toBe(true)
  })
})
