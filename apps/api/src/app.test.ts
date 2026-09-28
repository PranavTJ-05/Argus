import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import type { ArgusConfig } from "@argus/config"
import type {
  AccountsRepository,
  AuthRepository,
  IntegrationsRepository,
  InvestigationsRepository,
} from "@argus/db"

import { buildApiApp } from "./app.js"
import { hashSecretToken } from "./tokens.js"
import { parseRequestPart } from "./validation.js"

const config: ArgusConfig = {
  runtime: {
    nodeEnv: "test",
    logLevel: "error",
  },
  api: {
    host: "127.0.0.1",
    port: 3001,
    apiKey: "test-api-key",
    publicUrl: "http://localhost:3001",
    rateLimitMax: 60,
    rateLimitWindowMs: 60_000,
    requestBodyLimitBytes: 65_536,
    corsOrigin: "http://localhost:3000",
  },
  auth: {
    bootstrapEmail: "owner@example.com",
    bootstrapPassword: "correct-password",
    bootstrapWorkspaceName: "Example Workspace",
    integrationSecretKey: "test-integration-secret-key",
  },
  database: {
    url: "postgres://argus:argus@localhost:5432/argus",
  },
  worker: {
    host: "127.0.0.1",
    port: 3002,
  },
  inngest: {
    eventKey: "test-event-key",
    signingKey: "test-signing-key",
    apiBaseUrl: "http://localhost:8288",
  },
  llm: {
    anthropicApiKey: "test-anthropic-key",
    modelAliases: {
      "director.primary": "director-model",
      "expert.cheap": "expert-model",
      "critic.balanced": "critic-model",
      "counsel.balanced": "counsel-model",
      "reporter.primary": "reporter-model",
    },
  },
  observabilityBackends: {},
  integrations: {},
  otel: {
    serviceName: "argus-api",
    tracesExporter: "otlp",
    metricsExporter: "otlp",
    logsExporter: "otlp",
  },
}

const investigations: InvestigationsRepository = {
  async advancePhase() {
    throw new Error("advancePhase should not run in API tests")
  },
  async appendDissentEntry() {
    throw new Error("appendDissentEntry should not run in API tests")
  },
  async appendEvent(input) {
    return {
      id: "33333333-3333-4333-8333-333333333333",
      investigationId: input.investigationId,
      sequence: 1,
      eventType: input.eventType,
      payload: input.payload,
      createdAt: "2026-05-23T00:00:00.000Z",
    }
  },
  async appendJournalEntry() {
    throw new Error("appendJournalEntry should not run in API tests")
  },
  async appendReviewFinding() {
    throw new Error("appendReviewFinding should not run in API tests")
  },
  async appendTimelineEvent() {
    throw new Error("appendTimelineEvent should not run in API tests")
  },
  async completeInvestigation() {
    throw new Error("completeInvestigation should not run in API tests")
  },
  async cancelInvestigation(id) {
    return {
      id,
      incidentId: "checkout-latency-2026-05-23",
      status: "cancelled",
      currentPhase: "done",
      currentRound: 0,
      confidence: null,
      totalCostUsd: null,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    }
  },
  async create(input) {
    return {
      id: "11111111-1111-4111-8111-111111111111",
      incidentId: input.incidentId,
      status: "running",
      currentPhase: "triage",
      currentRound: 0,
      confidence: null,
      totalCostUsd: null,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    }
  },
  async list() {
    return [
      {
        id: "11111111-1111-4111-8111-111111111111",
        incidentId: "checkout-latency-2026-05-23",
        status: "running",
        currentPhase: "triage",
        currentRound: 0,
        confidence: null,
        totalCostUsd: null,
        createdAt: "2026-05-23T00:00:00.000Z",
        updatedAt: "2026-05-23T00:00:00.000Z",
      },
    ]
  },
  async getById(id) {
    if (id !== "11111111-1111-4111-8111-111111111111") {
      return null
    }

    return {
      id,
      incidentId: "checkout-latency-2026-05-23",
      status: "running",
      currentPhase: "triage",
      currentRound: 0,
      confidence: null,
      totalCostUsd: null,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    }
  },
  async getArtifacts(id) {
    if (id !== "11111111-1111-4111-8111-111111111111") {
      return null
    }

    return {
      investigationId: id,
      journalEntries: [],
      reviewFindings: [],
      timelineEvents: [],
      dissentEntries: [],
    }
  },
  async getReport(id) {
    if (id !== "11111111-1111-4111-8111-111111111111") {
      return null
    }

    return {
      investigationId: id,
      finalReport: null,
      confidence: null,
    }
  },
  async getToolCall(id, toolCallId) {
    if (
      id !== "11111111-1111-4111-8111-111111111111" ||
      toolCallId !== "44444444-4444-4444-8444-444444444444"
    ) {
      return null
    }

    return {
      id: toolCallId,
      investigationId: id,
      stepKey: "r0-expert-trace_expert",
      expertName: "trace_expert",
      toolName: "mock.trace_summary",
      arguments: {
        query: "checkout latency trace summary",
      },
      result: {
        p95Ms: 1840,
      },
      error: null,
      durationMs: 12,
      createdAt: "2026-05-23T00:00:00.000Z",
    }
  },
  async getEventsAfter(id, sequence) {
    if (id !== "11111111-1111-4111-8111-111111111111") {
      return null
    }

    if (sequence >= 7) {
      return []
    }

    return [
      {
        id: "33333333-3333-4333-8333-333333333333",
        investigationId: id,
        sequence: 7,
        eventType: "phase_changed",
        payload: {
          from: null,
          to: "triage",
        },
        createdAt: "2026-05-23T00:00:00.000Z",
      },
    ]
  },
  async failInvestigation() {
    throw new Error("failInvestigation should not run in API tests")
  },
  async upsertAgentOutput() {
    throw new Error("upsertAgentOutput should not run in API tests")
  },
  async upsertTimelineMetadata() {
    throw new Error("upsertTimelineMetadata should not run in API tests")
  },
  async upsertToolCall() {
    throw new Error("upsertToolCall should not run in API tests")
  },
}

const auth: AuthRepository = {
  async createWorkspaceOwner(input) {
    if (input.email === "owner@example.com") {
      throw new Error("user already exists")
    }

    return {
      user: {
        id: "99999999-9999-4999-8999-999999999991",
        email: input.email,
        displayName: "new owner",
      },
      workspace: {
        id: "99999999-9999-4999-8999-999999999992",
        name: input.workspaceName,
        slug: "new-workspace",
        role: "admin",
      },
    }
  },
  async createSession(input) {
    return {
      id: "55555555-5555-4555-8555-555555555555",
      user: {
        id: input.userId,
        email: "owner@example.com",
        displayName: "owner",
      },
      workspace: {
        id: "66666666-6666-4666-8666-666666666666",
        name: "Example Workspace",
        slug: "example-workspace",
        role: "admin",
      },
      expiresAt: input.expiresAt.toISOString(),
    }
  },
  async deleteSessionByTokenHash() {},
  async createWorkspaceApiKey(input) {
    return {
      id: "88888888-8888-4888-8888-888888888888",
      workspaceId: input.workspaceId,
      name: input.name,
      keyPrefix: input.keyPrefix,
      status: "active",
      lastUsedAt: null,
      createdAt: "2026-05-23T00:00:00.000Z",
      revokedAt: null,
    }
  },
  async ensureBootstrapUser(input) {
    return {
      user: {
        id: "77777777-7777-4777-8777-777777777777",
        email: input.email,
        displayName: "owner",
      },
      workspace: {
        id: "66666666-6666-4666-8666-666666666666",
        name: input.workspaceName,
        slug: "example-workspace",
        role: "admin",
      },
    }
  },
  async getSessionByTokenHash(tokenHash) {
    if (tokenHash !== hashSecretToken("session-token")) {
      return null
    }

    return {
      id: "55555555-5555-4555-8555-555555555555",
      user: {
        id: "77777777-7777-4777-8777-777777777777",
        email: "owner@example.com",
        displayName: "owner",
      },
      workspace: {
        id: "66666666-6666-4666-8666-666666666666",
        name: "Example Workspace",
        slug: "example-workspace",
        role: "admin",
      },
      expiresAt: "2026-05-30T00:00:00.000Z",
    }
  },
  async getLoginUserByEmail(email) {
    if (email !== "member@example.com") {
      return null
    }

    return {
      id: "99999999-9999-4999-8999-999999999993",
      email,
      displayName: "member",
      passwordHash:
        "scrypt$dGVzdC1zYWx0LTEyMzQ1Njc$HOuLv-6wEmDRCH9DFHb3Tc0lVsr9nsxpybo-dtpKdt68UMgHH9rc1bwSz32z1JbL5POhfpo8ggzSbiWeFR8rUw",
    }
  },
  async getWorkspaceByApiKeyHash(keyHash) {
    if (keyHash !== hashSecretToken("tc_live_workspace_key")) {
      return null
    }

    return {
      keyId: "88888888-8888-4888-8888-888888888888",
      workspaceId: "66666666-6666-4666-8666-666666666666",
    }
  },
  async listWorkspaceApiKeys() {
    return [
      {
        id: "88888888-8888-4888-8888-888888888888",
        workspaceId: "66666666-6666-4666-8666-666666666666",
        name: "Default integration key",
        keyPrefix: "tc_live_abcdef...",
        status: "active",
        lastUsedAt: null,
        createdAt: "2026-05-23T00:00:00.000Z",
        revokedAt: null,
      },
    ]
  },
  async revokeWorkspaceApiKey(input) {
    return input.keyId === "88888888-8888-4888-8888-888888888888"
  },
}

const accounts: AccountsRepository = {
  async getWorkspaceAccount(workspaceId) {
    return {
      id: workspaceId,
      name: "Example Workspace",
      slug: "example-workspace",
      status: "active",
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    }
  },
  async getWorkspaceUsage(workspaceId) {
    return {
      workspaceId,
      investigationCount: 12,
      runningInvestigationCount: 2,
      completedInvestigationCount: 8,
      failedInvestigationCount: 2,
      cancelledInvestigationCount: 0,
      inputTokens: 1000,
      outputTokens: 500,
      totalCostUsd: 0.0312,
      totalLlmDurationMs: 4500,
      averageWorkflowLatencyMs: 120_000,
    }
  },
  async setWorkspaceStatus(input) {
    return {
      id: input.workspaceId,
      name: "Example Workspace",
      slug: "example-workspace",
      status: input.status,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    }
  },
}

const integrations: IntegrationsRepository = {
  async disableWorkspaceIntegration(input) {
    return input.provider === "github"
  },
  async listWorkspaceIntegrations(workspaceId) {
    return [
      {
        id: "99999999-9999-4999-8999-999999999999",
        workspaceId,
        provider: "github",
        status: "connected",
        config: {
          owner: "octo",
          repo: "repo",
        },
        hasSecret: true,
        secretKeyHint: "...1234",
        createdAt: "2026-05-23T00:00:00.000Z",
        updatedAt: "2026-05-23T00:00:00.000Z",
      },
    ]
  },
  async resolveForInvestigation() {
    return {
      github: {
        owner: "octo",
        repo: "repo",
        token: "secret-token",
      },
    }
  },
  async upsertWorkspaceIntegration(input) {
    return {
      id: "99999999-9999-4999-8999-999999999999",
      workspaceId: input.workspaceId,
      provider: input.provider,
      status: "connected",
      config: input.config,
      hasSecret: Boolean(input.secret),
      secretKeyHint: input.secret ? "...1234" : null,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    }
  },
}

function buildApiAppWithNoopPublisher() {
  return buildApiApp({
    config,
    investigations,
    publishInvestigationRequested: async () => {},
  })
}

describe("API app", () => {
  it("serves health status", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/health",
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["x-argus-request-id"]).toEqual(expect.any(String))
    expect(response.json()).toEqual({
      ok: true,
      service: "argus-api",
      environment: "test",
      telemetryEnabled: false,
    })
  })

  it("fails closed if production API is started without auth", () => {
    expect(() =>
      buildApiApp({
        config: {
          ...config,
          runtime: {
            ...config.runtime,
            nodeEnv: "production",
          },
        },
        investigations,
      }),
    ).toThrow("production API requires auth repository")
  })

  it("does not set CORS headers for untrusted origins", async () => {
    const app = buildApiApp({ auth, config, investigations })

    const response = await app.inject({
      headers: {
        origin: "https://evil.example",
      },
      method: "GET",
      url: "/health",
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["access-control-allow-origin"]).toBeUndefined()
  })

  it("sets CORS headers only for the configured dashboard origin", async () => {
    const app = buildApiApp({ auth, config, investigations })

    const response = await app.inject({
      headers: {
        origin: "http://localhost:3000",
      },
      method: "OPTIONS",
      url: "/investigations",
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000")
    expect(response.headers["access-control-allow-headers"]).toBe(
      "content-type,authorization,x-api-key",
    )
  })

  it("returns a structured validation error", async () => {
    const app = buildApiApp({ config, investigations })

    app.post("/test-validation", async (request) => {
      const body = parseRequestPart(
        z
          .object({
            incidentId: z.string().min(1),
          })
          .strict(),
        request.body,
      )

      return body
    })

    const response = await app.inject({
      method: "POST",
      url: "/test-validation",
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      error: "validation_failed",
      message: "request validation failed",
      issues: [
        {
          path: ["incidentId"],
          code: "invalid_type",
        },
      ],
    })
  })

  it("creates a bootstrap auth session", async () => {
    const app = buildApiApp({ auth, config, investigations })

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "owner@example.com",
        password: "correct-password",
      },
      url: "/auth/login",
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      session: {
        user: {
          email: "owner@example.com",
        },
        workspace: {
          role: "admin",
        },
      },
    })
    expect(response.json().sessionToken).toEqual(expect.any(String))
  })

  it("creates a self-serve workspace signup session", async () => {
    const createWorkspaceOwner = vi.fn(auth.createWorkspaceOwner)
    const app = buildApiApp({
      auth: {
        ...auth,
        createWorkspaceOwner,
      },
      config,
      investigations,
    })

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "new@example.com",
        password: "correct-password",
        workspaceName: "New Workspace",
      },
      url: "/auth/signup",
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      session: {
        workspace: {
          role: "admin",
        },
      },
      sessionToken: expect.any(String),
    })
    expect(createWorkspaceOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        passwordHash: expect.stringMatching(/^scrypt\$/),
        workspaceName: "New Workspace",
      }),
    )
  })

  it("rejects duplicate signup emails", async () => {
    const app = buildApiApp({ auth, config, investigations })

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "owner@example.com",
        password: "correct-password",
        workspaceName: "Example Workspace",
      },
      url: "/auth/signup",
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toMatchObject({
      error: "email_already_registered",
    })
  })

  it("logs in password-backed self-serve users", async () => {
    const app = buildApiApp({ auth, config, investigations })

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "member@example.com",
        password: "correct-password",
      },
      url: "/auth/login",
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().sessionToken).toEqual(expect.any(String))
  })

  it("rejects invalid dashboard credentials", async () => {
    const app = buildApiApp({ auth, config, investigations })

    const response = await app.inject({
      method: "POST",
      payload: {
        email: "owner@example.com",
        password: "wrong-password",
      },
      url: "/auth/login",
    })

    expect(response.statusCode).toBe(401)
  })

  it("returns the current session for bearer session tokens", async () => {
    const app = buildApiApp({ auth, config, investigations })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "GET",
      url: "/auth/me",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      user: {
        email: "owner@example.com",
      },
      workspace: {
        slug: "example-workspace",
      },
    })
  })

  it("creates workspace API keys for the logged-in workspace", async () => {
    const createWorkspaceApiKey = vi.fn(auth.createWorkspaceApiKey)
    const app = buildApiApp({
      auth: {
        ...auth,
        createWorkspaceApiKey,
      },
      config,
      investigations,
    })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "POST",
      payload: {
        name: "PagerDuty webhook",
      },
      url: "/workspace/api-keys",
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      apiKey: expect.stringMatching(/^tc_live_/),
      key: {
        name: "PagerDuty webhook",
        keyPrefix: expect.stringMatching(/^tc_live_/),
        status: "active",
      },
    })
    expect(createWorkspaceApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "66666666-6666-4666-8666-666666666666",
        userId: "77777777-7777-4777-8777-777777777777",
        name: "PagerDuty webhook",
        keyHash: expect.any(String),
      }),
    )
  })

  it("lists workspace API key metadata without raw secrets", async () => {
    const app = buildApiApp({ auth, config, investigations })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "GET",
      url: "/workspace/api-keys",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([
      {
        id: "88888888-8888-4888-8888-888888888888",
        workspaceId: "66666666-6666-4666-8666-666666666666",
        name: "Default integration key",
        keyPrefix: "tc_live_abcdef...",
        status: "active",
        lastUsedAt: null,
        createdAt: "2026-05-23T00:00:00.000Z",
        revokedAt: null,
      },
    ])
    expect(JSON.stringify(response.json())).not.toContain("tc_live_workspace_key")
  })

  it("revokes workspace API keys", async () => {
    const revokeWorkspaceApiKey = vi.fn(auth.revokeWorkspaceApiKey)
    const app = buildApiApp({
      auth: {
        ...auth,
        revokeWorkspaceApiKey,
      },
      config,
      investigations,
    })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "POST",
      url: "/workspace/api-keys/88888888-8888-4888-8888-888888888888/revoke",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
    expect(revokeWorkspaceApiKey).toHaveBeenCalledWith({
      workspaceId: "66666666-6666-4666-8666-666666666666",
      keyId: "88888888-8888-4888-8888-888888888888",
    })
  })

  it("rotates workspace API keys by revoking and replacing them", async () => {
    const createWorkspaceApiKey = vi.fn(auth.createWorkspaceApiKey)
    const revokeWorkspaceApiKey = vi.fn(auth.revokeWorkspaceApiKey)
    const app = buildApiApp({
      auth: {
        ...auth,
        createWorkspaceApiKey,
        revokeWorkspaceApiKey,
      },
      config,
      investigations,
    })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "POST",
      url: "/workspace/api-keys/88888888-8888-4888-8888-888888888888/rotate",
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      apiKey: expect.stringMatching(/^tc_live_/),
      revokedKeyId: "88888888-8888-4888-8888-888888888888",
      key: {
        name: "Default integration key",
        status: "active",
      },
    })
    expect(revokeWorkspaceApiKey).toHaveBeenCalledWith({
      workspaceId: "66666666-6666-4666-8666-666666666666",
      keyId: "88888888-8888-4888-8888-888888888888",
    })
    expect(createWorkspaceApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Default integration key",
        workspaceId: "66666666-6666-4666-8666-666666666666",
      }),
    )
  })

  it("returns workspace account usage for dashboard admins", async () => {
    const app = buildApiApp({ accounts, auth, config, investigations })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "GET",
      url: "/workspace/account",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      account: {
        id: "66666666-6666-4666-8666-666666666666",
        status: "active",
      },
      usage: {
        investigationCount: 12,
        failedInvestigationCount: 2,
        totalCostUsd: 0.0312,
      },
      policy: {
        suspended: "workspace cannot create investigations but can read historical data",
      },
    })
  })

  it("lets workspace admins update account status for manual billing control", async () => {
    const setWorkspaceStatus = vi.fn(accounts.setWorkspaceStatus)
    const app = buildApiApp({
      accounts: {
        ...accounts,
        setWorkspaceStatus,
      },
      auth,
      config,
      investigations,
    })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "PUT",
      payload: {
        status: "suspended",
      },
      url: "/workspace/account",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      id: "66666666-6666-4666-8666-666666666666",
      status: "suspended",
    })
    expect(setWorkspaceStatus).toHaveBeenCalledWith({
      workspaceId: "66666666-6666-4666-8666-666666666666",
      status: "suspended",
    })
  })

  it("lists workspace integration metadata without raw secrets", async () => {
    const app = buildApiApp({ auth, config, integrations, investigations })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "GET",
      url: "/workspace/integrations",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([
      {
        id: "99999999-9999-4999-8999-999999999999",
        workspaceId: "66666666-6666-4666-8666-666666666666",
        provider: "github",
        status: "connected",
        config: {
          owner: "octo",
          repo: "repo",
        },
        hasSecret: true,
        secretKeyHint: "...1234",
        createdAt: "2026-05-23T00:00:00.000Z",
        updatedAt: "2026-05-23T00:00:00.000Z",
      },
    ])
    expect(JSON.stringify(response.json())).not.toContain("secret-token")
  })

  it("saves workspace integrations inside the logged-in workspace", async () => {
    const upsertWorkspaceIntegration = vi.fn(integrations.upsertWorkspaceIntegration)
    const app = buildApiApp({
      auth,
      config,
      integrations: {
        ...integrations,
        upsertWorkspaceIntegration,
      },
      investigations,
    })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "PUT",
      payload: {
        config: {
          owner: "octo",
          repo: "repo",
        },
        secret: "github-token-1234",
      },
      url: "/workspace/integrations/github",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      provider: "github",
      hasSecret: true,
      secretKeyHint: "...1234",
    })
    expect(upsertWorkspaceIntegration).toHaveBeenCalledWith({
      workspaceId: "66666666-6666-4666-8666-666666666666",
      provider: "github",
      config: {
        owner: "octo",
        repo: "repo",
      },
      secret: "github-token-1234",
    })
  })

  it("disables workspace integrations only inside the logged-in workspace", async () => {
    const disableWorkspaceIntegration = vi.fn(integrations.disableWorkspaceIntegration)
    const app = buildApiApp({
      auth,
      config,
      integrations: {
        ...integrations,
        disableWorkspaceIntegration,
      },
      investigations,
    })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "DELETE",
      url: "/workspace/integrations/github",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
    expect(disableWorkspaceIntegration).toHaveBeenCalledWith({
      workspaceId: "66666666-6666-4666-8666-666666666666",
      provider: "github",
    })
  })

  it("requires auth for workspace-scoped investigation reads", async () => {
    const app = buildApiApp({ auth, config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/investigations",
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: "unauthorized",
      message: "missing or invalid session",
    })
  })

  it("scopes investigation reads to the bearer session workspace", async () => {
    const list = vi.fn(async () => [])
    const app = buildApiApp({
      auth,
      config,
      investigations: {
        ...investigations,
        list,
      },
    })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "GET",
      url: "/investigations",
    })

    expect(response.statusCode).toBe(200)
    expect(list).toHaveBeenCalledWith("66666666-6666-4666-8666-666666666666")
  })

  it("creates investigations in the bearer session workspace", async () => {
    const create = vi.fn(investigations.create)
    const app = buildApiApp({
      accounts,
      auth,
      config,
      investigations: {
        ...investigations,
        create,
      },
      publishInvestigationRequested: async () => {},
    })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "POST",
      payload: {
        incidentId: "checkout-latency-2026-05-23",
      },
      url: "/investigations",
    })

    expect(response.statusCode).toBe(201)
    expect(create).toHaveBeenCalledWith({
      incidentId: "checkout-latency-2026-05-23",
      triggerPayload: {},
      workspaceId: "66666666-6666-4666-8666-666666666666",
    })
  })

  it("lets workspace sessions cancel running investigations", async () => {
    const cancelInvestigation = vi.fn(investigations.cancelInvestigation)
    const appendEvent = vi.fn(investigations.appendEvent)
    const app = buildApiApp({
      auth,
      config,
      investigations: {
        ...investigations,
        appendEvent,
        cancelInvestigation,
      },
    })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "POST",
      url: "/investigations/11111111-1111-4111-8111-111111111111/cancel",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      status: "cancelled",
    })
    expect(cancelInvestigation).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111")
    expect(appendEvent).toHaveBeenCalledWith({
      eventType: "phase_changed",
      investigationId: "11111111-1111-4111-8111-111111111111",
      payload: {
        from: "triage",
        reason: "operator_cancelled",
        to: "done",
      },
    })
  })

  it("does not cancel investigations outside the workspace scope", async () => {
    const cancelInvestigation = vi.fn(investigations.cancelInvestigation)
    const app = buildApiApp({
      auth,
      config,
      investigations: {
        ...investigations,
        cancelInvestigation,
      },
    })

    const response = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "POST",
      url: "/investigations/22222222-2222-4222-8222-222222222222/cancel",
    })

    expect(response.statusCode).toBe(404)
    expect(cancelInvestigation).not.toHaveBeenCalled()
  })

  it("requires auth or workspace API key access for read APIs", async () => {
    const app = buildApiApp({ auth, config, investigations })

    const listResponse = await app.inject({
      method: "GET",
      url: "/investigations",
    })
    const reportResponse = await app.inject({
      method: "GET",
      url: "/investigations/11111111-1111-4111-8111-111111111111/report",
    })

    expect(listResponse.statusCode).toBe(401)
    expect(reportResponse.statusCode).toBe(401)
  })

  it("blocks new investigations for suspended workspaces but keeps historical reads available", async () => {
    const create = vi.fn(investigations.create)
    const suspendedAccounts: AccountsRepository = {
      ...accounts,
      async getWorkspaceAccount(workspaceId) {
        return {
          id: workspaceId,
          name: "Example Workspace",
          slug: "example-workspace",
          status: "suspended",
          createdAt: "2026-05-23T00:00:00.000Z",
          updatedAt: "2026-05-23T00:00:00.000Z",
        }
      },
    }
    const app = buildApiApp({
      accounts: suspendedAccounts,
      auth,
      config,
      investigations: {
        ...investigations,
        create,
      },
      publishInvestigationRequested: async () => {},
    })

    const createResponse = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "POST",
      payload: {
        incidentId: "checkout-latency-2026-05-23",
      },
      url: "/investigations",
    })
    const readResponse = await app.inject({
      headers: {
        authorization: "Bearer session-token",
      },
      method: "GET",
      url: "/investigations",
    })

    expect(createResponse.statusCode).toBe(403)
    expect(createResponse.json()).toMatchObject({
      error: "workspace_not_active",
      status: "suspended",
    })
    expect(create).not.toHaveBeenCalled()
    expect(readResponse.statusCode).toBe(200)
  })

  it("creates investigations in the workspace that owns the API key", async () => {
    const create = vi.fn(investigations.create)
    const app = buildApiApp({
      accounts,
      auth,
      config,
      investigations: {
        ...investigations,
        create,
      },
      publishInvestigationRequested: async () => {},
    })

    const response = await app.inject({
      headers: {
        authorization: "Bearer tc_live_workspace_key",
      },
      method: "POST",
      payload: {
        incidentId: "checkout-latency-2026-05-23",
      },
      url: "/investigations",
    })

    expect(response.statusCode).toBe(201)
    expect(create).toHaveBeenCalledWith({
      incidentId: "checkout-latency-2026-05-23",
      triggerPayload: {},
      workspaceId: "66666666-6666-4666-8666-666666666666",
    })
  })

  it("rate limits investigation creation by workspace API key identity", async () => {
    const create = vi.fn(investigations.create)
    const app = buildApiApp({
      accounts,
      auth,
      config: {
        ...config,
        api: {
          ...config.api,
          rateLimitMax: 1,
        },
      },
      investigations: {
        ...investigations,
        create,
      },
      publishInvestigationRequested: async () => {},
    })

    const first = await app.inject({
      headers: {
        authorization: "Bearer tc_live_workspace_key",
      },
      method: "POST",
      payload: {
        incidentId: "checkout-latency-2026-05-23",
      },
      url: "/investigations",
    })
    const second = await app.inject({
      headers: {
        authorization: "Bearer tc_live_workspace_key",
      },
      method: "POST",
      payload: {
        incidentId: "checkout-latency-2026-05-24",
      },
      url: "/investigations",
    })

    expect(first.statusCode).toBe(201)
    expect(second.statusCode).toBe(429)
    expect(second.json()).toMatchObject({
      error: "rate_limit_exceeded",
      message: "workspace rate limit exceeded",
    })
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("creates an investigation", async () => {
    const publishInvestigationRequested = vi.fn(async () => {})
    const app = buildApiApp({
      config,
      investigations,
      publishInvestigationRequested,
    })

    const response = await app.inject({
      headers: {
        "x-api-key": "test-api-key",
      },
      method: "POST",
      url: "/investigations",
      payload: {
        incidentId: "checkout-latency-2026-05-23",
        triggerPayload: {
          service: "checkout",
          severity: "high",
        },
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      incidentId: "checkout-latency-2026-05-23",
      status: "running",
      currentPhase: "triage",
      currentRound: 0,
      confidence: null,
      totalCostUsd: null,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    })
    expect(publishInvestigationRequested).toHaveBeenCalledWith({
      investigationId: "11111111-1111-4111-8111-111111111111",
      incidentId: "checkout-latency-2026-05-23",
      triggerPayload: {
        service: "checkout",
        severity: "high",
      },
    })
  })

  it("requires an API key for investigation creation", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "POST",
      url: "/investigations",
      payload: {
        incidentId: "checkout-latency-2026-05-23",
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({
      error: "unauthorized",
      message: "missing or invalid API key",
    })
  })

  it("accepts bearer API keys for external clients", async () => {
    const app = buildApiAppWithNoopPublisher()

    const response = await app.inject({
      headers: {
        authorization: "Bearer test-api-key",
      },
      method: "POST",
      url: "/investigations",
      payload: {
        incidentId: "checkout-latency-2026-05-23",
      },
    })

    expect(response.statusCode).toBe(201)
  })

  it("rate limits investigation creation", async () => {
    const app = buildApiApp({
      config: {
        ...config,
        api: {
          ...config.api,
          rateLimitMax: 1,
        },
      },
      investigations,
      publishInvestigationRequested: async () => {},
    })
    const request = {
      headers: {
        "x-api-key": "test-api-key",
      },
      method: "POST" as const,
      payload: {
        incidentId: "checkout-latency-2026-05-23",
      },
      url: "/investigations",
    }

    expect((await app.inject(request)).statusCode).toBe(201)
    const response = await app.inject(request)

    expect(response.statusCode).toBe(429)
    expect(response.headers["retry-after"]).toBeDefined()
    expect(response.json()).toMatchObject({
      error: "rate_limited",
      message: "rate limit exceeded",
    })
  })

  it("returns a structured request-size error", async () => {
    const app = buildApiApp({
      config: {
        ...config,
        api: {
          ...config.api,
          requestBodyLimitBytes: 32,
        },
      },
      investigations,
    })

    const response = await app.inject({
      headers: {
        "x-api-key": "test-api-key",
      },
      method: "POST",
      url: "/investigations",
      payload: {
        incidentId: "checkout-latency-2026-05-23",
        triggerPayload: {
          summary: "x".repeat(200),
        },
      },
    })

    expect(response.statusCode).toBe(413)
    expect(response.json()).toEqual({
      error: "payload_too_large",
      message: "request body exceeds configured limit",
    })
  })

  it("adds CORS headers for the configured dashboard origin", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      headers: {
        origin: "http://localhost:3000",
      },
      method: "GET",
      url: "/investigations",
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000")
    expect(response.headers.vary).toBe("Origin")
  })

  it("rejects invalid investigation create requests", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      headers: {
        "x-api-key": "test-api-key",
      },
      method: "POST",
      url: "/investigations",
      payload: {
        incidentId: "",
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      error: "validation_failed",
      message: "request validation failed",
    })
  })

  it("gets an investigation by id", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/investigations/11111111-1111-4111-8111-111111111111",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      incidentId: "checkout-latency-2026-05-23",
      status: "running",
      currentPhase: "triage",
      currentRound: 0,
      confidence: null,
      totalCostUsd: null,
      createdAt: "2026-05-23T00:00:00.000Z",
      updatedAt: "2026-05-23T00:00:00.000Z",
    })
  })

  it("lists investigations", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/investigations",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        incidentId: "checkout-latency-2026-05-23",
        status: "running",
        currentPhase: "triage",
        currentRound: 0,
        confidence: null,
        totalCostUsd: null,
        createdAt: "2026-05-23T00:00:00.000Z",
        updatedAt: "2026-05-23T00:00:00.000Z",
      },
    ])
  })

  it("rejects invalid investigation ids", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/investigations/not-a-uuid",
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      error: "validation_failed",
      message: "request validation failed",
    })
  })

  it("returns 404 for a missing investigation", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/investigations/22222222-2222-4222-8222-222222222222",
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: "not_found",
      message: "investigation not found",
    })
  })

  it("gets investigation artifacts", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/investigations/11111111-1111-4111-8111-111111111111/artifacts",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      investigationId: "11111111-1111-4111-8111-111111111111",
      journalEntries: [],
      reviewFindings: [],
      timelineEvents: [],
      dissentEntries: [],
    })
  })

  it("returns 404 for missing investigation artifacts", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/investigations/22222222-2222-4222-8222-222222222222/artifacts",
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: "not_found",
      message: "investigation not found",
    })
  })

  it("gets a final report envelope", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/investigations/11111111-1111-4111-8111-111111111111/report",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      investigationId: "11111111-1111-4111-8111-111111111111",
      finalReport: null,
      confidence: null,
    })
  })

  it("gets persisted tool call evidence", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/investigations/11111111-1111-4111-8111-111111111111/tool-calls/44444444-4444-4444-8444-444444444444",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      id: "44444444-4444-4444-8444-444444444444",
      toolName: "mock.trace_summary",
      result: {
        p95Ms: 1840,
      },
    })
  })

  it("streams investigation events as SSE", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/investigations/11111111-1111-4111-8111-111111111111/events?after=0",
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["content-type"]).toContain("text/event-stream")
    expect(response.body).toContain("id: 7\n")
    expect(response.body).toContain("event: phase_changed\n")
    expect(response.body).toContain('"sequence":7')
  })

  it("uses Last-Event-ID as the SSE reconnect cursor", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      headers: {
        "last-event-id": "7",
      },
      method: "GET",
      url: "/investigations/11111111-1111-4111-8111-111111111111/events",
    })

    expect(response.statusCode).toBe(200)
    expect(response.body).toBe("")
  })

  it("rejects invalid event stream cursors", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/investigations/11111111-1111-4111-8111-111111111111/events?after=-1",
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      error: "validation_failed",
      message: "request validation failed",
    })
  })

  it("returns 404 for missing investigation event streams", async () => {
    const app = buildApiApp({ config, investigations })

    const response = await app.inject({
      method: "GET",
      url: "/investigations/22222222-2222-4222-8222-222222222222/events",
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: "not_found",
      message: "investigation not found",
    })
  })
})
