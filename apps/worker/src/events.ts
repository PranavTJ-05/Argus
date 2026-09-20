import { z } from "zod"

import { jsonValueSchema, uuidSchema } from "@argus/shared-types"

export const investigationRequestedEventName = "investigation.requested"

export const investigationRequestedEventSchema = z
  .object({
    name: z.literal(investigationRequestedEventName),
    data: z
      .object({
        investigationId: uuidSchema,
        incidentId: z.string().trim().min(1),
        triggerPayload: jsonValueSchema,
      })
      .strict(),
  })
  .passthrough()

export type InvestigationRequestedEvent = z.infer<typeof investigationRequestedEventSchema>

export type ArgusInngestEvents = {
  [investigationRequestedEventName]: InvestigationRequestedEvent
}
