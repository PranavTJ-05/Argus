import { Inngest } from "inngest"

import type { ArgusConfig } from "@argus/config"

import type { InvestigationRequestedPublisher } from "./routes/investigations.js"

export function createInvestigationRequestedPublisher(
  config: ArgusConfig,
): InvestigationRequestedPublisher {
  const inngest = new Inngest({
    baseUrl:
      config.runtime.nodeEnv === "development" ? config.inngest.apiBaseUrl : "https://inn.gs",
    eventKey: config.inngest.eventKey,
    id: "argus-api",
    isDev: config.runtime.nodeEnv === "development",
  })

  return async ({ investigationId, incidentId, triggerPayload }) => {
    await inngest.send({
      name: "investigation.requested",
      data: {
        investigationId,
        incidentId,
        triggerPayload,
      },
    })
  }
}
