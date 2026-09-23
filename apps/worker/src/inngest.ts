import { EventSchemas, Inngest } from "inngest"

import type { ArgusConfig } from "@argus/config"

import type { InvestigationRequestedEvent } from "./events.js"

export function createArgusInngestClient(config: ArgusConfig) {
  return new Inngest({
    baseUrl: config.inngest.apiBaseUrl,
    checkpointing: true,
    id: "argus",
    eventKey: config.inngest.eventKey,
    isDev: config.runtime.nodeEnv === "development",
    signingKey: config.inngest.signingKey,
    schemas: new EventSchemas().fromUnion<InvestigationRequestedEvent>(),
  })
}
