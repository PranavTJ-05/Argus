import { randomUUID } from "node:crypto"

const apiBaseUrl = requiredEnv("API_BASE_URL").replace(/\/$/, "")
const dashboardUrl = process.env.DASHBOARD_URL?.replace(/\/$/, "")
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 180_000)
const startedAt = Date.now()

await expectOk(`${apiBaseUrl}/health`, "API health")

if (dashboardUrl) {
  await expectOk(`${dashboardUrl}/api/health`, "Dashboard health")
}

const auth = await createSmokeSession()
const sessionToken = expectString(auth.sessionToken, "sessionToken")

await getJson(`${apiBaseUrl}/auth/me`, sessionToken)

const apiKeyResponse = await postJson(
  `${apiBaseUrl}/workspace/api-keys`,
  {
    name: `launch-smoke-${new Date().toISOString()}`,
  },
  sessionToken,
)
const workspaceApiKey = expectString(apiKeyResponse.apiKey, "apiKey")

const investigation = await postJson(
  `${apiBaseUrl}/investigations`,
  {
    incidentId: `launch-smoke-${new Date().toISOString()}`,
    triggerPayload: {
      codePattern: process.env.SMOKE_CODE_PATTERN ?? "payment_authorize",
      environment: "prod",
      service: process.env.SMOKE_SERVICE_NAME ?? "checkout",
      summary: "Argus launch smoke investigation",
    },
  },
  workspaceApiKey,
)
const investigationId = expectString(investigation.id, "investigation.id")

await getJson(`${apiBaseUrl}/investigations`, sessionToken)

while (Date.now() - startedAt < timeoutMs) {
  const report = await getJson(
    `${apiBaseUrl}/investigations/${investigationId}/report`,
    sessionToken,
  )

  if (report.finalReport) {
    console.log(
      JSON.stringify({
        authMode: auth.mode,
        ok: true,
        confidence: report.confidence,
        investigationId,
        workspace: auth.session?.workspace?.slug ?? null,
      }),
    )
    process.exit(0)
  }

  await delay(5_000)
}

throw new Error(`launch smoke timed out waiting for report: ${investigationId}`)

async function createSmokeSession() {
  const email = process.env.ARGUS_LOGIN_EMAIL
  const password = process.env.ARGUS_LOGIN_PASSWORD

  if (email && password) {
    return {
      ...(await postJson(`${apiBaseUrl}/auth/login`, {
        email,
        password,
      })),
      mode: "login",
    }
  }

  const runId = randomUUID().slice(0, 8)
  return {
    ...(await postJson(`${apiBaseUrl}/auth/signup`, {
      email: process.env.ARGUS_SIGNUP_EMAIL ?? `launch-smoke-${runId}@argus.local`,
      password: process.env.ARGUS_SIGNUP_PASSWORD ?? `launch-smoke-${runId}-password`,
      workspaceName: process.env.ARGUS_SIGNUP_WORKSPACE ?? `Launch Smoke ${runId}`,
    })),
    mode: "signup",
  }
}

async function expectOk(url, label) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status}`)
  }
}

async function getJson(url, bearerToken) {
  const response = await fetch(url, {
    headers: bearerToken ? { authorization: `Bearer ${bearerToken}` } : undefined,
  })
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

async function postJson(url, body, bearerToken) {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
      "content-type": "application/json",
    },
    method: "POST",
  })

  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function requiredEnv(key) {
  const value = process.env[key]
  if (!value) {
    throw new Error(`${key} is required`)
  }

  return value
}

function expectString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }

  return value
}
