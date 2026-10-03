import { expect, test } from "@playwright/test"

const investigationId = "11111111-1111-4111-8111-111111111111"
const createdInvestigationId = "22222222-2222-4222-8222-222222222222"
const acceptanceInvestigationId = "55555555-5555-4555-8555-555555555555"
const acceptanceToolCallId = "66666666-6666-4666-8666-666666666660"
const toolCallId = "44444444-4444-4444-8444-444444444440"

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    {
      domain: "127.0.0.1",
      httpOnly: true,
      name: "argus_session",
      path: "/",
      sameSite: "Lax",
      value: "test-session",
    },
  ])

  await page.route("**/api/investigations", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          id: createdInvestigationId,
          incidentId: "checkout-api-spike-2026-05-24",
          status: "running",
          currentPhase: "triage",
          currentRound: 0,
          confidence: null,
          totalCostUsd: null,
          createdAt: "2026-05-24T00:00:00.000Z",
          updatedAt: "2026-05-24T00:00:00.000Z",
        },
        status: 201,
      })
      return
    }

    await route.fulfill({
      contentType: "application/json",
      json: [
        {
          id: investigationId,
          incidentId: "checkout-latency-2026-05-23",
          status: "completed",
          currentPhase: "done",
          currentRound: 1,
          confidence: 0.68,
          totalCostUsd: null,
          createdAt: "2026-05-23T00:00:00.000Z",
          updatedAt: "2026-05-23T00:00:00.000Z",
        },
      ],
    })
  })

  await page.route("**/api/workspace/api-keys", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          apiKey: "tc_live_created_test_key",
          key: {
            id: "88888888-8888-4888-8888-888888888888",
            workspaceId: "66666666-6666-4666-8666-666666666666",
            name: "Default integration key",
            keyPrefix: "tc_live_created...",
            status: "active",
            lastUsedAt: null,
            createdAt: "2026-05-24T00:00:00.000Z",
            revokedAt: null,
          },
        },
        status: 201,
      })
      return
    }

    await route.fulfill({
      contentType: "application/json",
      json: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          workspaceId: "66666666-6666-4666-8666-666666666666",
          name: "PagerDuty webhook",
          keyPrefix: "tc_live_existing...",
          status: "active",
          lastUsedAt: null,
          createdAt: "2026-05-23T00:00:00.000Z",
          revokedAt: null,
        },
      ],
    })
  })

  await page.route("**/api/workspace/api-keys/*/revoke", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: { ok: true },
    })
  })

  await page.route("**/api/workspace/account", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          id: "66666666-6666-4666-8666-666666666666",
          name: "Example Workspace",
          slug: "example-workspace",
          status: "suspended",
          createdAt: "2026-05-23T00:00:00.000Z",
          updatedAt: "2026-05-24T00:00:00.000Z",
        },
      })
      return
    }

    await route.fulfill({
      contentType: "application/json",
      headers: {
        "x-argus-request-id": "req_test_support",
      },
      json: {
        account: {
          id: "66666666-6666-4666-8666-666666666666",
          name: "Example Workspace",
          slug: "example-workspace",
          status: "active",
          createdAt: "2026-05-23T00:00:00.000Z",
          updatedAt: "2026-05-23T00:00:00.000Z",
        },
        usage: {
          workspaceId: "66666666-6666-4666-8666-666666666666",
          investigationCount: 12,
          runningInvestigationCount: 2,
          completedInvestigationCount: 8,
          failedInvestigationCount: 2,
          cancelledInvestigationCount: 0,
          inputTokens: 1000,
          outputTokens: 500,
          totalCostUsd: 0.0312,
          totalLlmDurationMs: 4500,
          averageWorkflowLatencyMs: 120000,
        },
        policy: {
          active: "workspace can create and read investigations",
          suspended: "workspace cannot create investigations but can read historical data",
          disabled: "workspace cannot create new investigations; operator review required",
        },
      },
    })
  })

  await page.route("**/api/auth/signup", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        session: {
          expiresAt: "2026-05-25T00:00:00.000Z",
          token: "signup-session",
          user: {
            displayName: null,
            email: "founder@example.com",
            id: "12121212-1212-4121-8121-121212121212",
          },
          workspace: {
            id: "66666666-6666-4666-8666-666666666666",
            name: "Founder Workspace",
            slug: "founder-workspace",
            status: "active",
          },
        },
        sessionToken: "signup-session-token",
      },
      status: 201,
    })
  })

  await page.route("**/api/workspace/integrations", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: [
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
      ],
    })
  })

  await page.route("**/api/workspace/integrations/*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        id: "99999999-9999-4999-8999-999999999999",
        workspaceId: "66666666-6666-4666-8666-666666666666",
        provider: route.request().url().split("/").pop() ?? "github",
        status: "connected",
        config: {
          endpoint: "http://prometheus:9090",
        },
        hasSecret: false,
        secretKeyHint: null,
        createdAt: "2026-05-23T00:00:00.000Z",
        updatedAt: "2026-05-23T00:00:00.000Z",
      },
    })
  })

  await page.route(`**/api/investigations/${investigationId}/artifacts`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        investigationId,
        journalEntries: [],
        reviewFindings: [],
        timelineEvents: [],
        dissentEntries: [
          {
            id: "99999999-9999-4999-8999-999999999999",
            roundNumber: 0,
            counterArgument: "Deploy and flag evidence are missing.",
            dissentStrength: 0.45,
            evidenceCited: [{ source_type: "evidence_gap" }],
            directorResponse: "Run another TRACE round.",
            resolved: false,
            createdAt: "2026-05-23T00:00:00.000Z",
          },
        ],
      },
    })
  })

  await page.route(`**/api/investigations/${investigationId}/report`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        investigationId,
        confidence: 0.68,
        finalReport: {
          verdict:
            "Incident checkout-latency-2026-05-23 is most likely caused by elevated checkout latency.",
          confidence: 0.68,
          timeline: [
            {
              timestamp: "2026-05-23T00:00:00.000Z",
              text: "Checkout p95 latency spiked.",
              source_ids: ["55555555-5555-4555-8555-555555555550"],
            },
          ],
          evidence_chain: [
            {
              claim: "Checkout latency increased sharply.",
              sourceType: "tool_call",
              sourceId: toolCallId,
              relevance: "direct",
            },
          ],
          dissent_considered:
            "Counsel raised unresolved dissent with strength 0.45; confidence was reduced.",
          recommended_fix: {
            immediate: "Inspect payment_authorize.",
            long_term: "Add trace-backed checks.",
          },
        },
      },
    })
  })

  await page.route(
    `**/api/investigations/${investigationId}/tool-calls/${toolCallId}`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          id: toolCallId,
          investigationId,
          stepKey: "r0-expert-trace_expert",
          expertName: "trace_expert",
          toolName: "mock.trace_summary",
          arguments: { query: "checkout latency trace summary" },
          result: { p95Ms: 1840 },
          error: null,
          durationMs: 12,
          createdAt: "2026-05-23T00:00:00.000Z",
        },
      })
    },
  )

  await page.route(`**/api/investigations/${investigationId}/events?after=0`, async (route) => {
    const event = {
      id: "33333333-3333-4333-8333-333333333333",
      investigationId,
      sequence: 1,
      eventType: "phase_changed",
      payload: { from: "trace", to: "verdict" },
      createdAt: "2026-05-23T00:00:00.000Z",
    }

    await route.fulfill({
      body: `id: 1\nevent: phase_changed\ndata: ${JSON.stringify(event)}\n\n`,
      contentType: "text/event-stream; charset=utf-8",
    })
  })

  await page.route(`**/api/investigations/${createdInvestigationId}/artifacts`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        investigationId: createdInvestigationId,
        journalEntries: [],
        reviewFindings: [],
        timelineEvents: [],
        dissentEntries: [],
      },
    })
  })

  await page.route(`**/api/investigations/${createdInvestigationId}/report`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        error: "not_found",
        message: "investigation not found",
      },
      status: 404,
    })
  })

  await page.route(
    `**/api/investigations/${createdInvestigationId}/events?after=0`,
    async (route) => {
      await route.fulfill({
        body: "",
        contentType: "text/event-stream; charset=utf-8",
      })
    },
  )
})

test("shows the login form", async ({ page }) => {
  await page.goto("/login")

  await expect(page.getByRole("heading", { name: "Sign in to Argus" })).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password")).toBeVisible()
  await expect(page.getByRole("link", { name: "Create a workspace" })).toBeVisible()
})

test("shows the public launch page and creates a workspace", async ({ page }) => {
  await page.goto("/landing")

  await expect(
    page.getByRole("heading", { name: /Incident reasoning with evidence and dissent/ }),
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Create workspace" }).first()).toBeVisible()
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible()
  await expect(page.getByText(/Every fetched artifact is stored as cited evidence/)).toBeVisible()
  await expect(page.getByText(/Dissents stay visible on the report/)).toBeVisible()
  await expect(page.getByText(/captured tool results and configured sources/)).toBeVisible()
  await expect(page.getByRole("link", { name: "Export postmortem" })).toBeVisible()

  await page.getByRole("link", { name: "Create workspace" }).first().click()
  await page.getByLabel("Email").fill("founder@example.com")
  await page.getByLabel("Workspace name").fill("Founder Workspace")
  await page.getByLabel("Password").fill("correct-password")
  await page.getByRole("button", { name: "Create workspace" }).click()

  await expect(page).toHaveURL("/")
})

test("completes the first-customer journey from signup to report review", async ({ page }) => {
  let investigationCreated = false

  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          window.localStorage.setItem("last-copied-text", text)
        },
      },
    })
  })

  await page.route("**/api/investigations", async (route) => {
    const investigation = {
      id: acceptanceInvestigationId,
      incidentId: "checkout-p95-first-customer-2026-05-27",
      status: "completed",
      currentPhase: "done",
      currentRound: 1,
      confidence: 0.72,
      totalCostUsd: 0.0189,
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:05:00.000Z",
    }

    if (route.request().method() === "POST") {
      investigationCreated = true
      await route.fulfill({
        contentType: "application/json",
        headers: {
          "x-argus-request-id": "req_acceptance_create",
        },
        json: investigation,
        status: 201,
      })
      return
    }

    await route.fulfill({
      contentType: "application/json",
      json: investigationCreated ? [investigation] : [],
    })
  })

  await page.route(
    `**/api/investigations/${acceptanceInvestigationId}/artifacts`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          investigationId: acceptanceInvestigationId,
          journalEntries: [],
          reviewFindings: [],
          timelineEvents: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              roundNumber: 1,
              timestamp: "2026-05-27T00:01:00.000Z",
              text: "GitHub deploy and checkout metric evidence were gathered.",
              sourceIds: [acceptanceToolCallId],
              createdAt: "2026-05-27T00:01:00.000Z",
            },
          ],
          dissentEntries: [
            {
              id: "88888888-8888-4888-8888-888888888888",
              roundNumber: 1,
              counterArgument: "The deploy correlation could be coincidental without log evidence.",
              dissentStrength: 0.25,
              evidenceCited: [{ source_type: "tool_call", source_id: acceptanceToolCallId }],
              directorResponse: "Reporter marked confidence medium and recommended verification.",
              resolved: false,
              createdAt: "2026-05-27T00:02:00.000Z",
            },
          ],
        },
      })
    },
  )

  await page.route(`**/api/investigations/${acceptanceInvestigationId}/report`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        investigationId: acceptanceInvestigationId,
        confidence: 0.72,
        finalReport: {
          verdict:
            "Checkout p95 latency is most likely caused by the payment_authorize deploy changing request fanout.",
          confidence: 0.72,
          timeline: [
            {
              timestamp: "2026-05-27T00:01:00.000Z",
              text: "Checkout p95 crossed the alert threshold after the payment deploy.",
              source_ids: [acceptanceToolCallId],
            },
          ],
          evidence_chain: [
            {
              claim: "GitHub deploy evidence and checkout metrics point to payment_authorize.",
              sourceType: "tool_call",
              sourceId: acceptanceToolCallId,
              relevance: "direct",
            },
          ],
          dissent_considered:
            "Counsel noted missing log evidence, so the report recommends verification before declaring final root cause.",
          recommended_fix: {
            immediate:
              "Inspect the payment_authorize deploy and temporarily roll back if p95 remains elevated.",
            long_term: "Add log and trace coverage for checkout payment fanout.",
          },
        },
      },
    })
  })

  await page.route(
    `**/api/investigations/${acceptanceInvestigationId}/tool-calls/${acceptanceToolCallId}`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          id: acceptanceToolCallId,
          investigationId: acceptanceInvestigationId,
          stepKey: "r1-expert-github",
          expertName: "trace_expert",
          toolName: "github.deploy_and_metric_summary",
          arguments: {
            codePattern: "payment_authorize",
            service: "checkout",
          },
          result: {
            commitSha: "abc1234",
            p95Ms: 1840,
            service: "checkout",
          },
          error: null,
          durationMs: 520,
          createdAt: "2026-05-27T00:01:00.000Z",
        },
      })
    },
  )

  await page.route(
    `**/api/investigations/${acceptanceInvestigationId}/events?after=0`,
    async (route) => {
      await route.fulfill({
        body: "",
        contentType: "text/event-stream; charset=utf-8",
      })
    },
  )

  await page.goto("/landing")
  await expect(
    page.getByRole("heading", { name: /Incident reasoning with evidence and dissent/ }),
  ).toBeVisible()

  await page.getByRole("link", { name: "Create workspace" }).first().click()
  await page.getByLabel("Email").fill("founder@example.com")
  await page.getByLabel("Workspace name").fill("Founder Workspace")
  await page.getByLabel("Password").fill("correct-password")
  await page.getByRole("button", { name: "Create workspace" }).click()
  await expect(page).toHaveURL("/")

  await page.getByRole("button", { name: "Setup" }).click()
  await expect(page.getByRole("heading", { name: "Connect Argus" })).toBeVisible()
  await page.getByRole("button", { name: "Create API key" }).click()
  await expect(page.getByText("tc_live_created_test_key", { exact: true })).toBeVisible()
  await page.getByLabel("GitHub owner").fill("acme")
  await page.getByLabel("GitHub repo").fill("checkout")
  await page.getByLabel("GitHub token").fill("github_pat_readonly")
  await page.getByRole("button", { name: "Save GitHub" }).click()
  await expect(page.getByText("GitHub").first()).toBeVisible()

  await page.getByRole("button", { name: "+ New" }).click()
  await page.getByLabel("Incident ID").fill("checkout-p95-first-customer-2026-05-27")
  await page.getByLabel("Summary").fill("Checkout p95 increased after payment deploy.")
  await page.getByLabel("Service").fill("checkout")
  await page.getByLabel("Code pattern").fill("payment_authorize")
  await page.getByRole("button", { name: "Start investigation" }).click()
  await expect(page.getByText("checkout-p95-first-customer-2026-05-27").first()).toBeVisible()

  await page.getByRole("button", { exact: true, name: "Report" }).click()
  await expect(page.getByRole("heading", { name: "Review Brief" })).toBeVisible()
  await expect(page.getByText("Checkout p95 latency is most likely caused")).toBeVisible()
  await page.getByRole("button", { name: /Open supporting evidence/ }).click()
  await expect(
    page.getByRole("heading", { name: "github.deploy_and_metric_summary" }),
  ).toBeVisible()
  await expect(page.getByText("abc1234")).toBeVisible()

  await page.getByRole("button", { name: "Copy Slack summary" }).click()
  await expect(page.getByText("Slack summary copied")).toBeVisible()
  const postmortemDownload = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export postmortem" }).click()
  await expect((await postmortemDownload).suggestedFilename()).toBe("argus-postmortem.md")
})

test("renders inbox, report, live view, replay, and evidence detail", async ({ page }) => {
  await page.addInitScript((id) => {
    type Listener = (event: MessageEvent) => void

    class MockEventSource {
      static readonly CLOSED = 2
      static readonly CONNECTING = 0
      static readonly OPEN = 1

      readonly url: string
      onerror: ((event: Event) => void) | null = null
      onmessage: ((event: MessageEvent) => void) | null = null
      onopen: ((event: Event) => void) | null = null
      readyState = MockEventSource.CONNECTING
      private readonly listeners = new Map<string, Listener[]>()

      constructor(url: string | URL) {
        this.url = String(url)
        window.setTimeout(() => {
          this.readyState = MockEventSource.OPEN
          this.onopen?.(new Event("open"))
          this.emit("phase_changed", {
            id: "33333333-3333-4333-8333-333333333333",
            investigationId: id,
            sequence: 1,
            eventType: "phase_changed",
            payload: { from: "trace", to: "verdict" },
            createdAt: "2026-05-23T00:00:00.000Z",
          })
        }, 200)
      }

      addEventListener(type: string, listener: Listener) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
      }

      close() {
        this.readyState = MockEventSource.CLOSED
      }

      private emit(type: string, payload: unknown) {
        const event = new MessageEvent(type, { data: JSON.stringify(payload) })
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event)
        }
        this.onmessage?.(event)
      }
    }

    window.EventSource = MockEventSource as unknown as typeof EventSource
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          window.localStorage.setItem("last-copied-text", text)
        },
      },
    })
  }, investigationId)

  await page.goto("/")

  await expect(page.getByText("checkout-latency-2026-05-23").first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "Review Brief" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Share Report" })).toBeVisible()
  await page.getByRole("button", { name: "Copy Slack summary" }).click()
  await expect(page.getByText("Slack summary copied")).toBeVisible()
  await expect(page.getByRole("button", { name: "Copy email update" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Re-run with feedback" })).toBeDisabled()
  await expect(
    page.getByText("Not in v1. Create a new investigation with updated context instead."),
  ).toBeVisible()
  const postmortemDownload = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export postmortem" }).click()
  await expect((await postmortemDownload).suggestedFilename()).toBe("argus-postmortem.md")
  await expect(page.getByText("Incident checkout-latency-2026-05-23").first()).toBeVisible()
  await expect(page.getByText("Argus marked this as medium confidence")).toBeVisible()
  await expect(page.getByText("Counsel raised unresolved dissent").first()).toBeVisible()
  await expect(
    page.getByText("Code or deploy evidence is missing or unavailable.").first(),
  ).toBeVisible()

  await page.getByRole("button", { name: /Open supporting evidence/ }).click()
  await expect(page.getByRole("heading", { name: "mock.trace_summary" })).toBeVisible()
  await expect(page.getByText("1840")).toBeVisible()

  await page.getByText("Checkout latency increased sharply.").click()
  await expect(page.getByRole("heading", { name: "mock.trace_summary" })).toBeVisible()
  await expect(page.getByText("1840")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Action Plan" })).toBeVisible()
  await expect(page.getByText("Immediate", { exact: true })).toBeVisible()
  await expect(page.getByText("Verification", { exact: true })).toBeVisible()
  await expect(page.getByText("Prevention", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: /Live View/ }).click()
  await expect(page.getByRole("heading", { name: /Live View|No live events loaded/ })).toBeVisible()

  await page.getByRole("button", { name: "Replay" }).click()
  await expect(page.getByRole("heading", { exact: true, name: "Replay" })).toBeVisible()
  await expect(page.getByText("read-only replay")).toBeVisible()
  await expect(page.getByText("Move the slider to replay")).toBeVisible()
  await page.getByLabel("Replay event position").fill("1")
  await expect(page.getByRole("heading", { name: "Investigation moved phase" })).toBeVisible()
  await expect(page.getByText("Raw event payload", { exact: true })).toBeVisible()
})

test("maps customer-facing evidence errors to operator diagnostics", async ({ page }) => {
  await page.route(
    `**/api/investigations/${investigationId}/tool-calls/${toolCallId}`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        headers: {
          "x-argus-request-id": "req_tool_failure",
        },
        json: {
          error: "upstream_down",
          message: "Evidence service is temporarily unavailable.",
        },
        status: 500,
      })
    },
  )

  await page.goto("/")
  await page.getByRole("button", { name: /Open supporting evidence/ }).click()

  await expect(page.getByText("Evidence service is temporarily unavailable.")).toBeVisible()
  await expect(page.getByText("Reference ID: req_tool_failure.")).toBeVisible()
  await expect(page.getByText("Give support request ID")).toBeVisible()

  await page.getByRole("button", { exact: true, name: "Support" }).click()

  await expect(page.getByRole("heading", { name: "Support References" })).toBeVisible()
  await expect(page.getByText("Latest customer error diagnostic")).toBeVisible()
  const diagnostic = page.locator(".tc-support-diagnostic")
  await expect(diagnostic.getByText("evidence_load")).toBeVisible()
  await expect(diagnostic.getByText("500")).toBeVisible()
  await expect(diagnostic.getByText("req_tool_failure")).toBeVisible()
  await expect(diagnostic.getByText("upstream_down")).toBeVisible()
})

test("keeps the dashboard frame stable while investigations load", async ({ page }) => {
  await page.route("**/api/investigations", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await route.fulfill({
      contentType: "application/json",
      json: [
        {
          id: investigationId,
          incidentId: "checkout-latency-2026-05-23",
          status: "completed",
          currentPhase: "done",
          currentRound: 1,
          confidence: 0.68,
          totalCostUsd: null,
          createdAt: "2026-05-23T00:00:00.000Z",
          updatedAt: "2026-05-23T00:00:00.000Z",
        },
      ],
    })
  })

  await page.goto("/")

  await expect(page.getByLabel("Loading investigations")).toBeVisible()
  await expect(page.locator(".tc-incident-header")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Review Brief" })).toBeVisible()

  await page.getByRole("button", { name: "Refresh" }).click()
  await expect(page.getByRole("heading", { name: "Review Brief" })).toBeVisible()
  await expect(page.getByText("checkout-latency-2026-05-23").first()).toBeVisible()
})

test("keeps global search and inbox filter independent", async ({ page }) => {
  await page.goto("/")

  const globalSearch = page.getByLabel("Global investigation search")
  const inboxFilter = page.getByLabel("Inbox investigation filter")

  await globalSearch.fill("checkout")
  await expect(globalSearch).toHaveValue("checkout")
  await expect(inboxFilter).toHaveValue("")
  await expect(page.getByText("checkout-latency-2026-05-23").first()).toBeVisible()

  await globalSearch.fill("")
  await inboxFilter.fill("done")
  await expect(globalSearch).toHaveValue("")
  await expect(inboxFilter).toHaveValue("done")
  await expect(page.getByText("checkout-latency-2026-05-23").first()).toBeVisible()
})

test("keeps the main review workflow visually stable on desktop", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 })
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Review Brief" })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const headerHeightBeforeRefresh = await page
    .locator(".tc-incident-header")
    .evaluate((element) => element.getBoundingClientRect().height)

  await page.getByRole("button", { name: "Refresh" }).click()
  await expect(page.getByRole("heading", { name: "Review Brief" })).toBeVisible()

  const headerHeightAfterRefresh = await page
    .locator(".tc-incident-header")
    .evaluate((element) => element.getBoundingClientRect().height)

  expect(Math.abs(headerHeightAfterRefresh - headerHeightBeforeRefresh)).toBeLessThanOrEqual(1)
  await expectNoHorizontalOverflow(page)

  await page.getByRole("button", { exact: true, name: "Evidence 1" }).click()
  await page.getByText("Checkout latency increased sharply.").click()
  await expect(page.getByRole("heading", { name: "mock.trace_summary" })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test("keeps the tablet dashboard usable without the inspector panel", async ({ page }) => {
  await page.setViewportSize({ height: 820, width: 1024 })
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Review Brief" })).toBeVisible()
  await expect(page.locator(".tc-detail")).toBeHidden()
  await expect(page.getByRole("button", { name: /Evidence/ })).toBeVisible()
})

test("creates an investigation from the dashboard form", async ({ page }) => {
  await page.goto("/")

  await page.getByRole("button", { name: "+ New" }).click()
  await page.getByLabel("Incident ID").fill("checkout-api-spike-2026-05-24")
  await page.getByLabel("Summary").fill("Checkout API 5xx errors increased after deploy.")
  await page.getByLabel("Service").fill("checkout")
  await page.getByLabel("Code pattern").fill("payment_authorize")
  await page.getByRole("button", { name: "Start investigation" }).click()

  await expect(page.getByText("checkout-api-spike-2026-05-24").first()).toBeVisible()
  await expect(page.getByText("investigating").first()).toBeVisible()
  await expect(page.getByRole("button", { name: /Live View/ })).toHaveClass(/tc-tab-active/)
})

test("shows in-product setup guide for customer integration", async ({ page }) => {
  await page.goto("/")

  await page.getByRole("button", { name: "Setup" }).click()

  await expect(page.getByRole("heading", { name: "Connect Argus" })).toBeVisible()
  await expect(page.getByText("http://localhost:3001", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "First-Run Checklist" })).toBeVisible()
  await expect(page.getByText("4 / 4 complete")).toBeVisible()
  await expect(page.getByText("Start with one demo incident.")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Known v1 Limits" })).toBeVisible()
  await expect(page.getByText("read before relying on a report")).toBeVisible()
  await expect(page.getByText(/Missing GitHub, Prometheus, Loki, Tempo/)).toBeVisible()
  await expect(page.getByText(/Low-confidence or unresolved-dissent reports/)).toBeVisible()
  await expect(page.getByText(/Team invites, SSO, automated billing/)).toBeVisible()
  await expect(page.getByText(/Hosted free Render services can cold start/)).toBeVisible()
  await expect(page.getByRole("heading", { name: "Workspace API Keys" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Account Controls" })).toBeVisible()
  await expect(page.getByText("Estimated cost")).toBeVisible()
  await expect(page.getByText("$0.0312")).toBeVisible()
  await page.getByLabel("Account status").selectOption("suspended")
  await expect(page.locator(".tc-status-suspended")).toHaveText("suspended")
  await expect(page.getByText("PagerDuty webhook")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Evidence Integrations" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "GitHub code and deploys" })).toBeVisible()
  await expect(page.getByText("...1234")).toBeVisible()
  await expect(page.getByText("/investigations").first()).toBeVisible()
  await expect(page.getByText("Customer or company provides")).toBeVisible()
  await expect(page.getByText("Operator service owns")).toBeVisible()
  await expect(page.getByText("Monitoring alert webhook")).toBeVisible()

  await page.getByRole("button", { name: "Create API key" }).click()
  await expect(page.getByText("Copy this API key now")).toBeVisible()
  await expect(page.getByText("tc_live_created_test_key", { exact: true })).toBeVisible()

  await page.getByLabel("Prometheus endpoint").fill("http://prometheus:9090")
  await page.getByRole("button", { name: "Save Prometheus" }).click()
  await expect(page.getByText("Prometheus").first()).toBeVisible()

  await page.getByRole("button", { name: "Create demo investigation" }).click()
  await expect(page.getByText("checkout-api-spike-2026-05-24").first()).toBeVisible()
  await expect(page.getByRole("button", { name: /Live View/ })).toHaveClass(/tc-tab-active/)
})

test("shows operator support visibility for workspace health", async ({ page }) => {
  await page.route("**/api/investigations", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: [
        {
          id: investigationId,
          incidentId: "checkout-latency-2026-05-23",
          status: "completed",
          currentPhase: "done",
          currentRound: 1,
          confidence: 0.68,
          totalCostUsd: 0.0123,
          createdAt: "2026-05-23T00:00:00.000Z",
          updatedAt: "2026-05-23T00:00:00.000Z",
        },
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          incidentId: "render-deploy-failed-2026-05-25",
          status: "failed",
          currentPhase: "trace",
          currentRound: 1,
          confidence: null,
          totalCostUsd: 0.0042,
          createdAt: "2026-05-25T15:00:00.000Z",
          updatedAt: "2026-05-25T15:15:00.000Z",
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          incidentId: "payments-trace-stuck-2026-05-25",
          status: "running",
          currentPhase: "trace",
          currentRound: 2,
          confidence: null,
          totalCostUsd: 0.0091,
          createdAt: "2026-05-25T14:00:00.000Z",
          updatedAt: "2026-05-25T14:10:00.000Z",
        },
      ],
    })
  })
  await page.route(
    "**/api/investigations/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cancel",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          incidentId: "payments-trace-stuck-2026-05-25",
          status: "cancelled",
          currentPhase: "done",
          currentRound: 2,
          confidence: null,
          totalCostUsd: 0.0091,
          createdAt: "2026-05-25T14:00:00.000Z",
          updatedAt: "2026-05-25T15:30:00.000Z",
        },
      })
    },
  )

  await page.goto("/")
  await page.getByRole("button", { name: "Support" }).click()

  await expect(page.getByRole("heading", { name: "Support Console" })).toBeVisible()
  await expect(page.getByText("Workspace", { exact: true })).toBeVisible()
  await expect(page.getByText("Failed runs", { exact: true })).toBeVisible()
  await expect(page.getByText("Stuck running", { exact: true })).toBeVisible()
  await expect(page.getByText("$0.0312")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Support References" })).toBeVisible()
  await expect(page.getByText("66666666-6666-4666-8666-666666666666")).toBeVisible()
  await expect(page.getByText("req_test_support")).toBeVisible()
  await expect(page.getByText("investigation-requested", { exact: true })).toBeVisible()
  await expect(page.getByText("investigation.requested", { exact: true })).toBeVisible()
  await expect(
    page.locator(".tc-support-row").filter({ hasText: "render-deploy-failed-2026-05-25" }),
  ).toBeVisible()
  await expect(
    page.locator(".tc-support-row").filter({ hasText: "payments-trace-stuck-2026-05-25" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Retry render-deploy-failed-2026-05-25" }),
  ).toBeDisabled()
  await expect(
    page.getByRole("button", { name: "Resolve render-deploy-failed-2026-05-25" }),
  ).toBeDisabled()
  await page.getByRole("button", { name: "Cancel payments-trace-stuck-2026-05-25" }).click()
  await expect(
    page.getByText("Cancel requested for payments-trace-stuck-2026-05-25."),
  ).toBeVisible()
})

test("serves dashboard health status", async ({ request }) => {
  const response = await request.get("/api/health")

  expect(response.status()).toBe(200)
  await expect(response.json()).resolves.toEqual({
    ok: true,
    service: "argus-dashboard",
  })
})

async function expectNoHorizontalOverflow(page: {
  evaluate: <T>(pageFunction: () => T | Promise<T>) => Promise<T>
}) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true)
}
