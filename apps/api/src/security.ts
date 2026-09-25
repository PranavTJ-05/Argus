import type { FastifyReply, FastifyRequest } from "fastify"

export class ApiAuthError extends Error {
  readonly statusCode = 401

  constructor() {
    super("missing or invalid API key")
    this.name = "ApiAuthError"
  }
}

export class RateLimitError extends Error {
  readonly statusCode = 429
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super("rate limit exceeded")
    this.name = "RateLimitError"
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export type ApiSecurityOptions = {
  apiKey: string
  rateLimitMax: number
  rateLimitWindowMs: number
}

export type RouteGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<void>

type RateLimitBucket = {
  count: number
  resetAt: number
}

export function createWriteGuard(options: ApiSecurityOptions): RouteGuard {
  const buckets = new Map<string, RateLimitBucket>()

  return async (request, reply) => {
    requireApiKey(request, options.apiKey)
    enforceRateLimit(request, reply, buckets, options)
  }
}

function requireApiKey(request: FastifyRequest, apiKey: string): void {
  if (hasApiKey(request, apiKey)) {
    return
  }

  throw new ApiAuthError()
}

export function hasApiKey(request: FastifyRequest, apiKey: string): boolean {
  return getPresentedApiKey(request) === apiKey
}

export function getPresentedApiKey(request: FastifyRequest): string | null {
  const header = request.headers.authorization ?? request.headers["x-api-key"]
  const provided = Array.isArray(header) ? header[0] : header
  const normalized = provided?.startsWith("Bearer ") ? provided.slice("Bearer ".length) : provided

  return normalized ?? null
}

function enforceRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  buckets: Map<string, RateLimitBucket>,
  options: ApiSecurityOptions,
): void {
  const now = Date.now()
  const key = `${request.ip}:${request.routeOptions.url ?? request.url}`
  const existing = buckets.get(key)
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : {
          count: 0,
          resetAt: now + options.rateLimitWindowMs,
        }

  bucket.count += 1
  buckets.set(key, bucket)

  const remaining = Math.max(options.rateLimitMax - bucket.count, 0)
  const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1)

  void reply.header("x-ratelimit-limit", options.rateLimitMax)
  void reply.header("x-ratelimit-remaining", remaining)
  void reply.header("x-ratelimit-reset", Math.ceil(bucket.resetAt / 1000))

  if (bucket.count > options.rateLimitMax) {
    throw new RateLimitError(retryAfterSeconds)
  }
}
