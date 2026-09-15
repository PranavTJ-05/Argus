import { type JsonValue, jsonValueSchema } from "@argus/shared-types"

import {
  type BackendLimits,
  enforceResultLimit,
  mergeBackendLimits,
  withTimeout,
} from "./limits.js"

export type FetchLike = (input: URL | string, init?: RequestInit) => Promise<Response>

export type HttpJsonOptions = {
  body?: JsonValue | undefined
  fetchImpl?: FetchLike | undefined
  headers?: Record<string, string> | undefined
  limits?: Partial<BackendLimits> | undefined
  method?: "GET" | "POST" | undefined
}

export async function fetchJson(url: URL, options: HttpJsonOptions = {}): Promise<JsonValue> {
  const limits = mergeBackendLimits(options.limits)
  const controller = new AbortController()
  const fetchImpl = options.fetchImpl ?? fetch
  const init: RequestInit = {
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...options.headers,
    },
    method: options.method ?? "GET",
    signal: controller.signal,
  }

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
  }

  const request = fetchImpl(url, init)

  try {
    const response = await withTimeout(request, limits.timeoutMs, url.toString())

    if (!response.ok) {
      throw new Error(`backend request failed: ${response.status} ${response.statusText}`)
    }

    const text = await withTimeout(response.text(), limits.timeoutMs, `${url.toString()} body`)
    const byteLength = Buffer.byteLength(text, "utf8")

    if (byteLength > limits.maxResultBytes) {
      throw new Error(`${url.toString()} result exceeded ${limits.maxResultBytes} bytes`)
    }

    const json = jsonValueSchema.parse(JSON.parse(text))
    return enforceResultLimit(json, limits.maxResultBytes, url.toString())
  } finally {
    controller.abort()
  }
}
