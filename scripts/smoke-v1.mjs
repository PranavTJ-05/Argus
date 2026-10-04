const apiBaseUrl = requiredEnv("API_BASE_URL").replace(/\/$/, "")
const apiKey = requiredEnv("API_KEY")
const dashboardUrl = process.env.DASHBOARD_URL?.replace(/\/$/, "")
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 120_000)
const startedAt = Date.now()

await expectOk(`${apiBaseUrl}/health`, "API health")

if (dashboardUrl) {
  await expectOk(`${dashboardUrl}/api/health`, "Dashboard health")
}

const investigation = await postJson(`${apiBaseUrl}/investigations`, {
  incidentId: `smoke-${new Date().toISOString()}`,
  triggerPayload: {
    environment: "prod",
    service: process.env.SMOKE_SERVICE_NAME ?? "checkout",
    summary: "Argus v1 smoke investigation",
  },
})

while (Date.now() - startedAt < timeoutMs) {
  const report = await getJson(`${apiBaseUrl}/investigations/${investigation.id}/report`)

  if (report.finalReport) {
    console.log(
      JSON.stringify({
        ok: true,
        confidence: report.confidence,
        investigationId: investigation.id,
        verdict: report.finalReport.verdict,
      }),
    )
    process.exit(0)
  }

  await delay(5_000)
}

throw new Error(`smoke timed out waiting for report: ${investigation.id}`)

async function expectOk(url, label) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status}`)
  }
}

async function getJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status}`)
  }

  return response.json()
}

async function postJson(url, body) {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${apiKey}`,
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
