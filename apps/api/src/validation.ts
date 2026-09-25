import type { FastifyInstance } from "fastify"
import { ZodError, type ZodIssue, type ZodType } from "zod"

import { ApiAuthError, RateLimitError } from "./security.js"

export class RequestValidationError extends Error {
  readonly statusCode = 400
  readonly issues: ZodIssue[]

  constructor(error: ZodError) {
    super("request validation failed")
    this.name = "RequestValidationError"
    this.issues = error.issues
  }
}

export function parseRequestPart<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)

  if (!result.success) {
    throw new RequestValidationError(result.error)
  }

  return result.data
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiAuthError) {
      void reply.status(error.statusCode).send({
        error: "unauthorized",
        message: error.message,
      })
      return
    }

    if (error instanceof RateLimitError) {
      void reply.status(error.statusCode).header("retry-after", error.retryAfterSeconds).send({
        error: "rate_limited",
        message: error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      })
      return
    }

    if (hasStatusCode(error) && error.statusCode === 413) {
      void reply.status(413).send({
        error: "payload_too_large",
        message: "request body exceeds configured limit",
      })
      return
    }

    if (error instanceof RequestValidationError) {
      void reply.status(error.statusCode).send({
        error: "validation_failed",
        message: error.message,
        issues: error.issues.map((issue) => ({
          path: issue.path,
          code: issue.code,
          message: issue.message,
        })),
      })
      return
    }

    if (error instanceof ZodError) {
      const validationError = new RequestValidationError(error)
      void reply.status(validationError.statusCode).send({
        error: "validation_failed",
        message: validationError.message,
        issues: validationError.issues.map((issue) => ({
          path: issue.path,
          code: issue.code,
          message: issue.message,
        })),
      })
      return
    }

    void reply.send(error)
  })
}

function hasStatusCode(error: unknown): error is { statusCode: number } {
  return (
    error !== null &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  )
}
