import type { ArgusConfig } from "@argus/config"

export type ArgusTelemetry = {
  enabled: boolean
  logsExporter: string
  metricsExporter: string
  resourceAttributes: Record<string, string>
  serviceName: string
  tracesExporter: string
}

export function createArgusTelemetry(
  config: ArgusConfig,
  serviceName = config.otel.serviceName,
): ArgusTelemetry {
  return {
    enabled: config.otel.exporterOtlpEndpoint !== undefined,
    logsExporter: config.otel.logsExporter,
    metricsExporter: config.otel.metricsExporter,
    resourceAttributes: {
      "deployment.environment": config.runtime.nodeEnv,
      "service.name": serviceName,
    },
    serviceName,
    tracesExporter: config.otel.tracesExporter,
  }
}
