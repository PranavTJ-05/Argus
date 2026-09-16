import type { JsonValue } from "@argus/shared-types"
import { z } from "zod"

import { type FetchLike, fetchJson } from "./http.js"
import type { BackendLimits } from "./limits.js"

const lokiLogQuerySchema = z
  .object({
    direction: z.enum(["forward", "backward"]).default("backward"),
    end: z.string().datetime().optional(),
    limit: z.number().int().positive().max(1000).default(100),
    query: z.string().trim().min(1),
    start: z.string().datetime().optional(),
  })
  .strict()

export type LokiLogQuery = z.input<typeof lokiLogQuerySchema>

export type LokiLogBackend = {
  queryLogs: (query: LokiLogQuery) => Promise<JsonValue>
}

export type LokiLogBackendOptions = {
  endpoint: string
  fetchImpl?: FetchLike | undefined
  limits?: Partial<BackendLimits> | undefined
}

export function createLokiLogBackend(options: LokiLogBackendOptions): LokiLogBackend {
  const endpoint = new URL(options.endpoint)

  return {
    async queryLogs(query) {
      const parsed = lokiLogQuerySchema.parse(query)
      const url = new URL("/loki/api/v1/query_range", endpoint)
      url.searchParams.set("query", parsed.query)
      url.searchParams.set("limit", parsed.limit.toString())
      url.searchParams.set("direction", parsed.direction)

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
