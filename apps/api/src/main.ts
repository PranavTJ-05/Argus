import { loadArgusConfig, loadLocalEnvFile } from "@argus/config"
import {
  createAccountsRepository,
  createAuthRepository,
  createDatabaseClient,
  createIntegrationsRepository,
  createInvestigationsRepository,
} from "@argus/db"

import { buildApiApp } from "./app.js"

loadLocalEnvFile()
const config = loadArgusConfig(process.env)
const databaseClient = createDatabaseClient(config.database.url)
const app = buildApiApp({
  accounts: createAccountsRepository(databaseClient.db),
  auth: createAuthRepository(databaseClient.db),
  config,
  integrations: createIntegrationsRepository(databaseClient.db, config.auth.integrationSecretKey),
  investigations: createInvestigationsRepository(databaseClient.db),
})

app.addHook("onClose", async () => {
  await databaseClient.close()
})

try {
  await app.listen({
    host: config.api.host,
    port: config.api.port,
  })
} catch (error) {
  app.log.error(error, "failed to start API server")
  process.exitCode = 1
}
