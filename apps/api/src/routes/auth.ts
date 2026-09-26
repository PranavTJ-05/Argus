import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

import type { FastifyInstance, FastifyRequest } from "fastify"
import { z } from "zod"

import type { ArgusConfig } from "@argus/config"
import type { AuthRepository } from "@argus/db"

import { hashSecretToken } from "../tokens.js"
import { parseRequestPart } from "../validation.js"

const loginRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict()

const signupRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(12).max(128),
    workspaceName: z.string().trim().min(2).max(80),
  })
  .strict()

const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 7

export function registerAuthRoutes(
  app: FastifyInstance,
  auth: AuthRepository,
  config: ArgusConfig,
): void {
  app.post("/auth/signup", async (request, reply) => {
    const body = parseRequestPart(signupRequestSchema, request.body)
    const email = body.email.trim().toLowerCase()

    try {
      const signup = await auth.createWorkspaceOwner({
        email,
        passwordHash: hashPassword(body.password),
        workspaceName: body.workspaceName.trim(),
      })
      const token = randomBytes(32).toString("base64url")
      const session = await auth.createSession({
        userId: signup.user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + sessionLifetimeMs),
      })

      return reply.code(201).send({
        sessionToken: token,
        session,
      })
    } catch (error) {
      if (error instanceof Error && error.message === "user already exists") {
        return reply.code(409).send({
          error: "email_already_registered",
          message: "email is already registered",
        })
      }

      throw error
    }
  })

  app.post("/auth/login", async (request, reply) => {
    const body = parseRequestPart(loginRequestSchema, request.body)
    const email = body.email.trim().toLowerCase()
    const user = await auth.getLoginUserByEmail(email)

    if (user?.passwordHash && verifyPassword(body.password, user.passwordHash)) {
      const token = randomBytes(32).toString("base64url")
      const session = await auth.createSession({
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + sessionLifetimeMs),
      })

      return reply.code(201).send({
        sessionToken: token,
        session,
      })
    }

    if (
      email !== config.auth.bootstrapEmail.trim().toLowerCase() ||
      !constantTimeEquals(body.password, config.auth.bootstrapPassword)
    ) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "invalid email or password",
      })
    }

    const bootstrap = await auth.ensureBootstrapUser({
      email,
      workspaceName: config.auth.bootstrapWorkspaceName,
    })
    const token = randomBytes(32).toString("base64url")
    const session = await auth.createSession({
      userId: bootstrap.user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + sessionLifetimeMs),
    })

    return reply.code(201).send({
      sessionToken: token,
      session,
    })
  })

  app.get("/auth/me", async (request, reply) => {
    const session = await getSessionFromRequest(auth, request)

    if (!session) {
      return reply.code(401).send({
        error: "unauthorized",
        message: "missing or invalid session",
      })
    }

    return session
  })

  app.post("/auth/logout", async (request) => {
    const token = getBearerToken(request)

    if (token) {
      await auth.deleteSessionByTokenHash(hashSessionToken(token))
    }

    return {
      ok: true,
    }
  })
}

export async function getSessionFromRequest(
  auth: AuthRepository,
  request: FastifyRequest,
): Promise<Awaited<ReturnType<AuthRepository["getSessionByTokenHash"]>>> {
  const token = getBearerToken(request)

  if (!token) {
    return null
  }

  return auth.getSessionByTokenHash(hashSessionToken(token))
}

function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  const value = Array.isArray(header) ? header[0] : header

  if (!value?.startsWith("Bearer ")) {
    return null
  }

  return value.slice("Bearer ".length)
}

function hashSessionToken(token: string): string {
  return hashSecretToken(token)
}

function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`
}

function verifyPassword(password: string, encodedHash: string): boolean {
  const [algorithm, salt, hash] = encodedHash.split("$")

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false
  }

  const expected = Buffer.from(hash, "base64url")
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), expected.byteLength)

  return timingSafeEqual(actual, expected)
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}
