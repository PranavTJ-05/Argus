import type { JsonValue } from "@argus/shared-types"
import { z } from "zod"

import { type FetchLike, fetchJson } from "./http.js"
import type { BackendLimits } from "./limits.js"

const tempoTraceQuerySchema = z
  .object({
    end: z.string().datetime().optional(),
    limit: z.number().int().positive().max(100).default(20),
    serviceName: z.string().trim().min(1),
    start: z.string().datetime().optional(),
  })
  .strict()

export type TempoTraceQuery = z.input<typeof tempoTraceQuerySchema>

export type TempoTraceSource = {
  searchTraces: (query: TempoTraceQuery) => Promise<JsonValue>
}

export type TempoTraceSourceOptions = {
  endpoint: string
  fetchImpl?: FetchLike | undefined
  limits?: Partial<BackendLimits> | undefined
}

export function createTempoTraceSource(options: TempoTraceSourceOptions): TempoTraceSource {
  const endpoint = new URL(options.endpoint)

  return {
    async searchTraces(query) {
      const parsed = tempoTraceQuerySchema.parse(query)
      const url = new URL("/api/search", endpoint)
      url.searchParams.set("tags", `service.name=${parsed.serviceName}`)
      url.searchParams.set("limit", parsed.limit.toString())

      if (parsed.start) {
        url.searchParams.set("start", String(Date.parse(parsed.start) * 1_000_000))
      }

      if (parsed.end) {
        url.searchParams.set("end", String(Date.parse(parsed.end) * 1_000_000))
      }

      return fetchJson(url, {
        fetchImpl: options.fetchImpl,
        limits: options.limits,
      })
    },
  }
}
