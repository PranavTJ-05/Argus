import { loadArgusConfig, loadLocalEnvFile } from "@argus/config"
import { createArgusTelemetry } from "@argus/otel"

export type WorkerHealth = {
  ok: true
  environment: string
  inngestBaseUrl: string
  service: "argus-worker"
  telemetryEnabled: boolean
}

export function buildWorkerHealth(): WorkerHealth {
  loadLocalEnvFile()
  const config = loadArgusConfig(process.env)
  const telemetry = createArgusTelemetry(config, "argus-worker")

  return {
    ok: true,
    environment: config.runtime.nodeEnv,
    inngestBaseUrl: config.inngest.apiBaseUrl,
    service: "argus-worker",
    telemetryEnabled: telemetry.enabled,
  }
}

if (process.argv[1]?.endsWith("health.js") || process.argv[1]?.endsWith("health.ts")) {
  console.log(JSON.stringify(buildWorkerHealth()))
}
