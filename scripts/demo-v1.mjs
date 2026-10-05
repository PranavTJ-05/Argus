const apiBaseUrl = requiredEnv("API_BASE_URL").replace(/\/$/, "")
const apiKey = requiredEnv("API_KEY")
const dashboardUrl = process.env.DASHBOARD_URL?.replace(/\/$/, "")
const timeoutMs = Number(process.env.DEMO_TIMEOUT_MS ?? 180_000)
const startedAt = Date.now()
const timestamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "")
const incidentId = process.env.DEMO_INCIDENT_ID ?? `demo-checkout-latency-${timestamp}`

await expectOk(`${apiBaseUrl}/health`, "API health")

if (dashboardUrl) {
  await expectOk(`${dashboardUrl}/api/health`, "Dashboard health")
}

const investigation = await postJson(`${apiBaseUrl}/investigations`, {
  incidentId,
  triggerPayload: {
    branch: process.env.DEMO_BRANCH ?? "main",
    codePattern: process.env.DEMO_CODE_PATTERN ?? "payment_authorize",
    commitSha: process.env.DEMO_COMMIT_SHA ?? "abc1234",
    deployRef: process.env.DEMO_DEPLOY_REF ?? "2026.05.24",
    end: process.env.DEMO_END ?? "2026-05-24T06:30:00.000Z",
    environment: process.env.DEMO_ENVIRONMENT ?? "prod",
    featureFlagContext: {
      rollout: process.env.DEMO_FLAG_CONTEXT ?? "checkout payment authorization rollout",
    },
    logQuery: process.env.DEMO_LOG_QUERY ?? '{service="checkout"}',
    metricQuery:
      process.env.DEMO_METRIC_QUERY ??
      'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="checkout"}[5m])) by (le))',
    service: process.env.DEMO_SERVICE_NAME ?? "checkout",
    serviceName: process.env.DEMO_SERVICE_NAME ?? "checkout",
    severity: process.env.DEMO_SEVERITY ?? "high",
    start: process.env.DEMO_START ?? "2026-05-24T06:00:00.000Z",
    summary:
      process.env.DEMO_SUMMARY ??
      "Checkout p95 latency increased after a payment authorization deploy.",
  },
})

while (Date.now() - startedAt < timeoutMs) {
  const report = await getJson(`${apiBaseUrl}/investigations/${investigation.id}/report`)

  if (report.finalReport) {
    console.log(
      JSON.stringify(
        {
          dashboardUrl: dashboardUrl || null,
          incidentId,
          investigationId: investigation.id,
          ok: true,
          reportUrl: `${apiBaseUrl}/investigations/${investigation.id}/report`,
          confidence: report.confidence,
          verdict: report.finalReport.verdict,
        },
        null,
        2,
      ),
    )
    process.exit(0)
  }

  await delay(5_000)
}

throw new Error(`demo timed out waiting for report: ${investigation.id}`)

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
