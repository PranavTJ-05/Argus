import { createServer } from "node:http"

import { createLiveAgentRunner } from "@argus/agents"
import { createArgusBackendRegistry } from "@argus/backends"
import { loadArgusConfig, loadLocalEnvFile } from "@argus/config"
import {
  createDatabaseClient,
  createIntegrationsRepository,
  createInvestigationsRepository,
} from "@argus/db"
import { createAnthropicGateway } from "@argus/llm-gateway"
import { createArgusTelemetry } from "@argus/otel"
import { serve } from "inngest/node"

import { createArgusFunctions } from "./functions/index.js"
import { createArgusInngestClient } from "./inngest.js"

loadLocalEnvFile()
const config = loadArgusConfig(process.env)
const telemetry = createArgusTelemetry(config, "argus-worker")
const databaseClient = createDatabaseClient(config.database.url)
const investigations = createInvestigationsRepository(databaseClient.db)
const integrations = createIntegrationsRepository(
  databaseClient.db,
  config.auth.integrationSecretKey,
)
const inngest = createArgusInngestClient(config)
const llmGateway = createAnthropicGateway({ apiKey: config.llm.anthropicApiKey })
const agents = createLiveAgentRunner({
  gateway: llmGateway,
  modelAliases: config.llm.modelAliases,
})
const functions = createArgusFunctions(inngest, {
  agents,
  investigations,
  modelAliases: config.llm.modelAliases,
  resolveBackends: async (investigationId) => {
    const workspaceIntegrations = await integrations.resolveForInvestigation(investigationId)
    return createArgusBackendRegistry({
      github: workspaceIntegrations.github,
      localRepoPath: config.runtime.nodeEnv === "development" ? process.cwd() : undefined,
      lokiEndpoint: workspaceIntegrations.loki?.endpoint,
      mockDeployments: [],
      prometheusEndpoint: workspaceIntegrations.prometheus?.endpoint,
      tempoEndpoint: workspaceIntegrations.tempo?.endpoint,
    })
  },
})
const inngestHandler = serve({
  client: inngest,
  functions,
})
const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, {
      "content-type": "application/json",
    })
    response.end(
      JSON.stringify({
        ok: true,
        environment: config.runtime.nodeEnv,
        service: "argus-worker",
        telemetryEnabled: telemetry.enabled,
      }),
    )
    return
  }

  if (request.url?.startsWith("/api/inngest")) {
    inngestHandler(request, response)
    return
  }

  response.writeHead(404, {
    "content-type": "application/json",
  })
  response.end(
    JSON.stringify({
      error: "not_found",
      message: "route not found",
    }),
  )
})

console.log(`Argus worker initialized with Inngest app ${inngest.id}`)
console.log(`Registered ${functions.length} Inngest function(s)`)
console.log(
  `Argus worker telemetry ${telemetry.enabled ? "enabled" : "disabled"} for ${telemetry.serviceName}`,
)

server.listen(config.worker.port, config.worker.host, () => {
  console.log(`Argus worker listening on ${config.worker.host}:${config.worker.port}`)
})

async function shutdown(): Promise<void> {
  server.close()
  await databaseClient.close()
}

process.once("SIGINT", () => {
  void shutdown().then(() => {
    process.exitCode = 0
  })
})
process.once("SIGTERM", () => {
  void shutdown().then(() => {
    process.exitCode = 0
  })
})
