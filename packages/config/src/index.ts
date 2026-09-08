import { loadEnvFile } from "node:process"
import { z } from "zod"

const nonEmptyString = z.string().trim().min(1)
const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  nonEmptyString.optional(),
)
const port = z.coerce.number().int().min(1).max(65535)
const url = z.string().url()

export const modelAliasConfigSchema = z
  .object({
    "director.primary": nonEmptyString,
    "expert.cheap": nonEmptyString,
    "critic.balanced": nonEmptyString,
    "counsel.balanced": nonEmptyString,
    "reporter.primary": nonEmptyString,
  })
  .strict()

export type ModelAliasConfig = z.infer<typeof modelAliasConfigSchema>

export const rawEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),

    API_HOST: nonEmptyString.default("0.0.0.0"),
    API_PORT: port.default(3001),
    API_KEY: nonEmptyString.default("dev_shared_api_key"),
    API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    API_REQUEST_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(65_536),
    API_CORS_ORIGIN: url.default("http://localhost:3000"),

    AUTH_BOOTSTRAP_EMAIL: nonEmptyString.default("owner@argus.local"),
    AUTH_BOOTSTRAP_PASSWORD: nonEmptyString.default("dev_argus_password"),
    AUTH_BOOTSTRAP_WORKSPACE_NAME: nonEmptyString.default("Argus Workspace"),
    INTEGRATION_SECRET_KEY: nonEmptyString.default("dev_integration_secret_key_change_me"),

    WORKER_HOST: nonEmptyString.default("0.0.0.0"),
    WORKER_PORT: port.default(3002),

    NEXT_PUBLIC_API_URL: url.default("http://localhost:3001"),

    DATABASE_URL: nonEmptyString.default("postgres://argus:argus@localhost:5432/argus"),

    INNGEST_EVENT_KEY: nonEmptyString.default("local_event_key"),
    INNGEST_SIGNING_KEY: nonEmptyString.default("local_signing_key"),
    INNGEST_BASE_URL: url.default("http://localhost:8288"),

    ANTHROPIC_API_KEY: nonEmptyString,

    MODEL_DIRECTOR_PRIMARY: nonEmptyString.default("claude-sonnet-4-6"),
    MODEL_EXPERT_CHEAP: nonEmptyString.default("claude-haiku-4-5-20251001"),
    MODEL_CRITIC_BALANCED: nonEmptyString.default("claude-sonnet-4-6"),
    MODEL_COUNSEL_BALANCED: nonEmptyString.default("claude-sonnet-4-6"),
    MODEL_REPORTER_PRIMARY: nonEmptyString.default("claude-sonnet-4-6"),

    TEMPO_ENDPOINT: url.optional(),
    LOKI_ENDPOINT: url.optional(),
    PROMETHEUS_ENDPOINT: url.optional(),
    GRAFANA_ENDPOINT: url.optional(),

    GITHUB_TOKEN: optionalNonEmptyString,
    GITHUB_OWNER: optionalNonEmptyString,
    GITHUB_REPO: optionalNonEmptyString,
    LAUNCHDARKLY_API_TOKEN: optionalNonEmptyString,

    OTEL_SERVICE_NAME: nonEmptyString.default("argus"),
    OTEL_EXPORTER_OTLP_ENDPOINT: url.optional(),
    OTEL_TRACES_EXPORTER: nonEmptyString.default("otlp"),
    OTEL_METRICS_EXPORTER: nonEmptyString.default("otlp"),
    OTEL_LOGS_EXPORTER: nonEmptyString.default("otlp"),
  })
  .strict()

export type RawEnv = z.input<typeof rawEnvSchema>
export type EnvInput = Record<string, string | undefined>

export const argusConfigSchema = z
  .object({
    runtime: z.object({
      nodeEnv: rawEnvSchema.shape.NODE_ENV,
      logLevel: rawEnvSchema.shape.LOG_LEVEL,
    }),
    api: z.object({
      host: nonEmptyString,
      port,
      apiKey: nonEmptyString,
      publicUrl: url,
      rateLimitMax: z.number().int().positive(),
      rateLimitWindowMs: z.number().int().positive(),
      requestBodyLimitBytes: z.number().int().positive(),
      corsOrigin: url,
    }),
    auth: z.object({
      bootstrapEmail: nonEmptyString,
      bootstrapPassword: nonEmptyString,
      bootstrapWorkspaceName: nonEmptyString,
      integrationSecretKey: nonEmptyString,
    }),
    worker: z.object({
      host: nonEmptyString,
      port,
    }),
    database: z.object({
      url: nonEmptyString,
    }),
    inngest: z.object({
      eventKey: nonEmptyString,
      signingKey: nonEmptyString,
      apiBaseUrl: url,
    }),
    llm: z.object({
      anthropicApiKey: nonEmptyString,
      modelAliases: modelAliasConfigSchema,
    }),
    observabilityBackends: z.object({
      tempoEndpoint: url.optional(),
      lokiEndpoint: url.optional(),
      prometheusEndpoint: url.optional(),
      grafanaEndpoint: url.optional(),
    }),
    integrations: z.object({
      githubToken: optionalNonEmptyString,
      githubOwner: optionalNonEmptyString,
      githubRepo: optionalNonEmptyString,
      launchDarklyApiToken: optionalNonEmptyString,
    }),
    otel: z.object({
      serviceName: nonEmptyString,
      exporterOtlpEndpoint: url.optional(),
      tracesExporter: nonEmptyString,
      metricsExporter: nonEmptyString,
      logsExporter: nonEmptyString,
    }),
  })
  .strict()

export type ArgusConfig = z.infer<typeof argusConfigSchema>

export function loadLocalEnvFile(path = ".env"): void {
  try {
    loadEnvFile(path)
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return
    }

    throw error
  }
}

export function loadArgusConfig(env: EnvInput): ArgusConfig {
  const parsedEnv = rawEnvSchema.parse(pickArgusEnv(env))

  return argusConfigSchema.parse({
    runtime: {
      nodeEnv: parsedEnv.NODE_ENV,
      logLevel: parsedEnv.LOG_LEVEL,
    },
    api: {
      host: parsedEnv.API_HOST,
      port: parsedEnv.API_PORT,
      apiKey: parsedEnv.API_KEY,
      publicUrl: parsedEnv.NEXT_PUBLIC_API_URL,
      rateLimitMax: parsedEnv.API_RATE_LIMIT_MAX,
      rateLimitWindowMs: parsedEnv.API_RATE_LIMIT_WINDOW_MS,
      requestBodyLimitBytes: parsedEnv.API_REQUEST_BODY_LIMIT_BYTES,
      corsOrigin: parsedEnv.API_CORS_ORIGIN,
    },
    auth: {
      bootstrapEmail: parsedEnv.AUTH_BOOTSTRAP_EMAIL,
      bootstrapPassword: parsedEnv.AUTH_BOOTSTRAP_PASSWORD,
      bootstrapWorkspaceName: parsedEnv.AUTH_BOOTSTRAP_WORKSPACE_NAME,
      integrationSecretKey: parsedEnv.INTEGRATION_SECRET_KEY,
    },
    worker: {
      host: parsedEnv.WORKER_HOST,
      port: parsedEnv.WORKER_PORT,
    },
    database: {
      url: parsedEnv.DATABASE_URL,
    },
    inngest: {
      eventKey: parsedEnv.INNGEST_EVENT_KEY,
      signingKey: parsedEnv.INNGEST_SIGNING_KEY,
      apiBaseUrl: parsedEnv.INNGEST_BASE_URL,
    },
    llm: {
      anthropicApiKey: parsedEnv.ANTHROPIC_API_KEY,
      modelAliases: {
        "director.primary": parsedEnv.MODEL_DIRECTOR_PRIMARY,
        "expert.cheap": parsedEnv.MODEL_EXPERT_CHEAP,
        "critic.balanced": parsedEnv.MODEL_CRITIC_BALANCED,
        "counsel.balanced": parsedEnv.MODEL_COUNSEL_BALANCED,
        "reporter.primary": parsedEnv.MODEL_REPORTER_PRIMARY,
      },
    },
    observabilityBackends: {
      tempoEndpoint: parsedEnv.TEMPO_ENDPOINT,
      lokiEndpoint: parsedEnv.LOKI_ENDPOINT,
      prometheusEndpoint: parsedEnv.PROMETHEUS_ENDPOINT,
      grafanaEndpoint: parsedEnv.GRAFANA_ENDPOINT,
    },
    integrations: {
      githubToken: parsedEnv.GITHUB_TOKEN,
      githubOwner: parsedEnv.GITHUB_OWNER,
      githubRepo: parsedEnv.GITHUB_REPO,
      launchDarklyApiToken: parsedEnv.LAUNCHDARKLY_API_TOKEN,
    },
    otel: {
      serviceName: parsedEnv.OTEL_SERVICE_NAME,
      exporterOtlpEndpoint: parsedEnv.OTEL_EXPORTER_OTLP_ENDPOINT,
      tracesExporter: parsedEnv.OTEL_TRACES_EXPORTER,
      metricsExporter: parsedEnv.OTEL_METRICS_EXPORTER,
      logsExporter: parsedEnv.OTEL_LOGS_EXPORTER,
    },
  })
}

function pickArgusEnv(env: EnvInput): EnvInput {
  return Object.fromEntries(
    Object.keys(rawEnvSchema.shape).map((key) => [key, env[key]]),
  ) as EnvInput
}
