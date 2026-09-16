import type { JsonValue } from "@argus/shared-types"
import { z } from "zod"

import { type FetchLike, fetchJson } from "./http.js"
import type { BackendLimits } from "./limits.js"

const prometheusMetricQuerySchema = z
  .object({
    end: z.string().datetime().optional(),
    query: z.string().trim().min(1),
    start: z.string().datetime().optional(),
    step: z.string().trim().min(1).default("30s"),
    time: z.string().datetime().optional(),
  })
  .strict()

export type PrometheusMetricQuery = z.input<typeof prometheusMetricQuerySchema>

export type PrometheusMetricBackend = {
  queryMetrics: (query: PrometheusMetricQuery) => Promise<JsonValue>
}

export type PrometheusMetricBackendOptions = {
  endpoint: string
  fetchImpl?: FetchLike | undefined
  limits?: Partial<BackendLimits> | undefined
}

export function createPrometheusMetricBackend(
  options: PrometheusMetricBackendOptions,
): PrometheusMetricBackend {
  const endpoint = new URL(options.endpoint)

  return {
    async queryMetrics(query) {
      const parsed = prometheusMetricQuerySchema.parse(query)
      const isRange = parsed.start !== undefined || parsed.end !== undefined
      const url = new URL(isRange ? "/api/v1/query_range" : "/api/v1/query", endpoint)
      url.searchParams.set("query", parsed.query)

      if (isRange) {
        url.searchParams.set("start", parsed.start ?? parsed.time ?? new Date().toISOString())
        url.searchParams.set("end", parsed.end ?? parsed.time ?? new Date().toISOString())
        url.searchParams.set("step", parsed.step)
      } else if (parsed.time) {
        url.searchParams.set("time", parsed.time)
      }

      return fetchJson(url, {
        fetchImpl: options.fetchImpl,
        limits: options.limits,
      })
    },
  }
}
