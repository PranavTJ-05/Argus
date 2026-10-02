"use client"

import type {
  Citation,
  CreateInvestigationRequest,
  InvestigationArtifacts,
  InvestigationEvent,
  InvestigationReport,
  InvestigationSummary,
  JsonValue,
  ToolCallArtifact,
} from "@argus/shared-types"
import type { Dispatch, FormEvent, SetStateAction } from "react"
import { useEffect, useMemo, useRef, useState } from "react"

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

type DashboardState = {
  artifacts: InvestigationArtifacts | null
  events: InvestigationEvent[]
  inbox: InvestigationSummary[]
  report: InvestigationReport | null
  selectedId: string | null
  selectedToolCall: ToolCallArtifact | null
}

type DashboardTab = "live" | "report" | "evidence" | "replay"
type LiveConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "closed"
type StatusFilter = "all" | InvestigationSummary["status"]
type ShareFormat = {
  body: string
  id: "email" | "postmortem" | "slack"
  label: string
}
type WorkspaceApiKey = {
  id: string
  workspaceId: string
  name: string
  keyPrefix: string
  status: "active" | "revoked"
  lastUsedAt: string | null
  createdAt: string
  revokedAt: string | null
}
type IntegrationProvider = "github" | "prometheus" | "loki" | "tempo" | "launchdarkly"
type WorkspaceIntegration = {
  id: string
  workspaceId: string
  provider: IntegrationProvider
  status: "connected" | "disabled"
  config: Record<string, unknown>
  hasSecret: boolean
  secretKeyHint: string | null
  createdAt: string
  updatedAt: string
}
type WorkspaceAccountResponse = {
  account: {
    id: string
    name: string
    slug: string
    status: "active" | "suspended" | "disabled"
    createdAt: string
    updatedAt: string
  }
  usage: {
    workspaceId: string
    investigationCount: number
    runningInvestigationCount: number
    completedInvestigationCount: number
    failedInvestigationCount: number
    cancelledInvestigationCount: number
    inputTokens: number
    outputTokens: number
    totalCostUsd: number
    totalLlmDurationMs: number
    averageWorkflowLatencyMs: number | null
  }
  policy: Record<string, string>
}
type DashboardDiagnostic = {
  message: string
  requestId: string | null
  source: string
  status: number | null
  upstreamError: string | null
}

class DashboardHttpError extends Error {
  readonly diagnostic: DashboardDiagnostic

  constructor(message: string, diagnostic: DashboardDiagnostic) {
    super(message)
    this.name = "DashboardHttpError"
    this.diagnostic = diagnostic
  }
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" })
  window.location.assign("/login")
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({
    artifacts: null,
    events: [],
    inbox: [],
    report: null,
    selectedId: null,
    selectedToolCall: null,
  })
  const [activeTab, setActiveTab] = useState<DashboardTab>("report")
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [globalQuery, setGlobalQuery] = useState("")
  const [inboxQuery, setInboxQuery] = useState("")
  const [replayIndex, setReplayIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [diagnostic, setDiagnostic] = useState<DashboardDiagnostic | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showSetupGuide, setShowSetupGuide] = useState(false)
  const [showSupportConsole, setShowSupportConsole] = useState(false)
  const [loading, setLoading] = useState(true)
  const [liveConnectionState, setLiveConnectionState] = useState<LiveConnectionState>("idle")
  const lastEventSequence = useRef(0)

  useEffect(() => {
    void refreshInbox(setState, setError, setLoading, setDiagnostic)
  }, [])

  useEffect(() => {
    if (!state.selectedId) {
      setLiveConnectionState("idle")
      return
    }

    let closed = false
    let source: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    const selectedId = state.selectedId
    lastEventSequence.current = 0

    setLoading(true)
    setLiveConnectionState("connecting")
    void Promise.all([
      fetchOptional<InvestigationArtifacts>(`/investigations/${selectedId}/artifacts`),
      fetchOptional<InvestigationReport>(`/investigations/${selectedId}/report`),
    ])
      .then(([artifacts, report]) => {
        if (!closed) {
          setState((current) => ({
            ...current,
            artifacts,
            events: [],
            report,
            selectedToolCall: null,
          }))
          setReplayIndex(0)
          setError(null)
          setDiagnostic(null)
        }
      })
      .catch((caught: unknown) => {
        if (!closed) {
          setError(formatCustomerError(caught, "Failed to load investigation"))
          setDiagnostic(toDashboardDiagnostic(caught, "investigation_load"))
        }
      })
      .finally(() => {
        if (!closed) {
          setLoading(false)
        }
      })

    const eventTypes = [
      "phase_changed",
      "agent_started",
      "agent_completed",
      "tool_started",
      "tool_completed",
      "artifact_written",
      "error",
    ]

    function connect(after: number) {
      setLiveConnectionState(after > 0 ? "reconnecting" : "connecting")
      source = new EventSource(`/api/investigations/${selectedId}/events?after=${after}`)

      source.onopen = () => {
        if (!closed) {
          setLiveConnectionState("connected")
        }
      }

      for (const eventType of eventTypes) {
        source.addEventListener(eventType, (message) => {
          const event = JSON.parse((message as MessageEvent).data as string) as InvestigationEvent
          lastEventSequence.current = Math.max(lastEventSequence.current, event.sequence)
          setState((current) => ({ ...current, events: upsertEvent(current.events, event) }))
        })
      }

      source.onerror = () => {
        source?.close()
        if (!closed) {
          setLiveConnectionState("reconnecting")
          reconnectTimer = setTimeout(() => connect(lastEventSequence.current), 1000)
        }
      }
    }

    connect(0)

    return () => {
      closed = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      source?.close()
      setLiveConnectionState("closed")
    }
  }, [state.selectedId])

  const selectedInvestigation = useMemo(
    () => state.inbox.find((investigation) => investigation.id === state.selectedId) ?? null,
    [state.inbox, state.selectedId],
  )
  const filteredInbox = useMemo(
    () =>
      state.inbox.filter((investigation) => {
        const matchesFilter = filter === "all" || investigation.status === filter
        const searchableText = [
          investigation.incidentId,
          investigation.status,
          investigation.currentPhase,
          investigation.id,
        ]
          .join(" ")
          .toLowerCase()
        const normalizedGlobalQuery = globalQuery.trim().toLowerCase()
        const normalizedInboxQuery = inboxQuery.trim().toLowerCase()
        const matchesGlobalQuery =
          normalizedGlobalQuery.length === 0 || searchableText.includes(normalizedGlobalQuery)
        const matchesInboxQuery =
          normalizedInboxQuery.length === 0 || searchableText.includes(normalizedInboxQuery)

        return matchesFilter && matchesGlobalQuery && matchesInboxQuery
      }),
    [filter, globalQuery, inboxQuery, state.inbox],
  )
  const finalReport = state.report?.finalReport ?? null
  const citations = finalReport?.evidence_chain ?? []
  const setupGaps = useMemo(
    () => (selectedInvestigation && finalReport ? getSetupGaps(finalReport, state.artifacts) : []),
    [finalReport, selectedInvestigation, state.artifacts],
  )
  const replayEvents = state.events.slice(0, Math.min(replayIndex, state.events.length))
  const stats = getInboxStats(state.inbox)

  return (
    <main className="tc-shell">
      <header className="tc-topbar">
        <div className="tc-brand">
          <div className="tc-logo">T</div>
          <div className="tc-brand-copy">
            <strong>Argus</strong>
            <span>Incident reasoning with evidence and dissent</span>
          </div>
        </div>
        <div className="tc-commandbar">
          <label className="tc-search" htmlFor="global-search">
            <span>Search</span>
            <input
              aria-label="Global investigation search"
              id="global-search"
              onChange={(event) => setGlobalQuery(event.target.value)}
              placeholder="Search investigations, phase, status..."
              value={globalQuery}
            />
            <kbd>/</kbd>
          </label>
          <StatusPill tone="green">prod</StatusPill>
          <StatusPill tone="neutral">Agents 5/5</StatusPill>
          <button
            className="tc-secondary-button"
            onClick={() => {
              setShowSupportConsole(false)
              setShowSetupGuide((current) => !current)
            }}
            type="button"
          >
            Setup
          </button>
          <button
            className="tc-secondary-button"
            onClick={() => {
              setShowSetupGuide(false)
              setShowSupportConsole((current) => !current)
            }}
            type="button"
          >
            Support
          </button>
          <button
            className="tc-icon-button"
            onClick={() => void refreshInbox(setState, setError, setLoading, setDiagnostic)}
            type="button"
          >
            Refresh
          </button>
          <button className="tc-secondary-button" onClick={() => void signOut()} type="button">
            Sign out
          </button>
        </div>
      </header>

      <div className="tc-workspace">
        <aside className="tc-inbox">
          <div className="tc-pane-header">
            <div>
              <h2>Investigations</h2>
              <span>{state.inbox.length} total</span>
            </div>
            <button
              className="tc-secondary-button"
              onClick={() => {
                setShowSetupGuide(false)
                setShowSupportConsole(false)
                setShowCreateForm((current) => !current)
                setFormError(null)
              }}
              type="button"
            >
              + New
            </button>
          </div>

          {showCreateForm ? (
            <CreateInvestigationForm
              creating={creating}
              error={formError}
              onCancel={() => {
                setShowCreateForm(false)
                setFormError(null)
              }}
              onCreate={(request) =>
                void createInvestigation(request, {
                  setActiveTab,
                  setCreating,
                  setDiagnostic,
                  setError,
                  setFormError,
                  setShowCreateForm,
                  setState,
                })
              }
            />
          ) : null}

          <div className="tc-filter-box">
            <input
              aria-label="Inbox investigation filter"
              onChange={(event) => setInboxQuery(event.target.value)}
              placeholder="Filter by id, phase, status..."
              value={inboxQuery}
            />
          </div>

          <div className="tc-tabs tc-tabs-compact">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              All {stats.total}
            </FilterButton>
            <FilterButton active={filter === "running"} onClick={() => setFilter("running")}>
              Running {stats.running}
            </FilterButton>
            <FilterButton active={filter === "completed"} onClick={() => setFilter("completed")}>
              Done {stats.completed}
            </FilterButton>
            <FilterButton active={filter === "failed"} onClick={() => setFilter("failed")}>
              Failed {stats.failed}
            </FilterButton>
          </div>

          <div className="tc-inbox-list">
            {loading && state.inbox.length === 0 ? <InboxSkeleton /> : null}
            {filteredInbox.map((investigation) => (
              <button
                className={`tc-inbox-row ${
                  state.selectedId === investigation.id ? "tc-inbox-row-selected" : ""
                }`}
                key={investigation.id}
                onClick={() => {
                  setState((current) => ({ ...current, selectedId: investigation.id }))
                  setActiveTab("report")
                }}
                type="button"
              >
                <span className={`tc-status-dot tc-status-dot-${investigation.status}`} />
                <div className="tc-inbox-row-main">
                  <div className="tc-inbox-title">
                    <strong>{investigation.incidentId}</strong>
                    <span>{relativeTime(investigation.updatedAt)}</span>
                  </div>
                  <div className="tc-inbox-meta">
                    <StatusBadge status={investigation.status} />
                    <span>{phaseLabel(investigation.currentPhase)}</span>
                    <span>run {investigation.currentRound}</span>
                    <ScoreBar value={investigation.confidence} />
                    <span>{formatScore(investigation.confidence)}</span>
                  </div>
                  <div className="tc-inbox-tags">
                    {isSmokeInvestigation(investigation.incidentId) ? <span>test data</span> : null}
                    {investigation.status === "failed" ? <span>needs attention</span> : null}
                  </div>
                </div>
              </button>
            ))}
            {!loading && filteredInbox.length === 0 ? (
              <EmptyState
                title="No investigations"
                body="Create the first investigation from your monitoring alert, script, or Argus API."
              />
            ) : null}
          </div>
        </aside>

        <section className="tc-main">
          <InvestigationHeader
            investigation={selectedInvestigation}
            loading={loading}
            report={state.report}
          />

          <nav className="tc-tabs tc-main-tabs" aria-label="Investigation sections">
            <TabButton active={activeTab === "live"} onClick={() => setActiveTab("live")}>
              Live View <span>{state.events.length}</span>
            </TabButton>
            <TabButton active={activeTab === "report"} onClick={() => setActiveTab("report")}>
              Report
            </TabButton>
            <TabButton active={activeTab === "evidence"} onClick={() => setActiveTab("evidence")}>
              Evidence <span>{citations.length}</span>
            </TabButton>
            <TabButton active={activeTab === "replay"} onClick={() => setActiveTab("replay")}>
              Replay
            </TabButton>
          </nav>

          <div className="tc-scroll-panel">
            {error ? <Notice tone="red">{error}</Notice> : null}
            {diagnostic ? <CustomerErrorReference diagnostic={diagnostic} /> : null}
            {showSetupGuide ? (
              <SetupGuide
                demoCreating={creating}
                hasCompletedInvestigation={state.inbox.some(
                  (investigation) => investigation.status === "completed",
                )}
                hasInvestigations={state.inbox.length > 0}
                onCreateDemo={() => {
                  setShowSetupGuide(false)
                  void createInvestigation(createDemoInvestigationRequest(), {
                    setActiveTab,
                    setCreating,
                    setDiagnostic,
                    setError,
                    setFormError,
                    setShowCreateForm,
                    setState,
                  })
                }}
              />
            ) : null}
            {showSupportConsole ? (
              <OperatorConsole
                inbox={state.inbox}
                loading={loading}
                diagnostic={diagnostic}
                onRefresh={() => void refreshInbox(setState, setError, setLoading, setDiagnostic)}
                selectedInvestigation={selectedInvestigation}
              />
            ) : null}
            {!showSetupGuide && !showSupportConsole && !selectedInvestigation ? (
              <EmptyState
                title="No investigation selected"
                body="Select an investigation from the inbox to review live events, evidence, and report."
              />
            ) : null}
            {!showSetupGuide &&
            !showSupportConsole &&
            selectedInvestigation &&
            activeTab === "live" ? (
              <LiveView
                connectionState={liveConnectionState}
                events={state.events}
                loading={loading}
              />
            ) : null}
            {!showSetupGuide &&
            !showSupportConsole &&
            selectedInvestigation &&
            activeTab === "report" ? (
              <ReportView
                artifacts={state.artifacts}
                loading={loading}
                onOpenEvidence={(citation) =>
                  void openEvidence(citation, state.selectedId, setState, setError, setDiagnostic)
                }
                report={finalReport}
                setupGaps={setupGaps}
              />
            ) : null}
            {!showSetupGuide &&
            !showSupportConsole &&
            selectedInvestigation &&
            activeTab === "evidence" ? (
              <EvidenceView
                citations={citations}
                loading={loading}
                onOpen={(citation) =>
                  void openEvidence(citation, state.selectedId, setState, setError, setDiagnostic)
                }
              />
            ) : null}
            {!showSetupGuide &&
            !showSupportConsole &&
            selectedInvestigation &&
            activeTab === "replay" ? (
              <ReplayView
                events={replayEvents}
                loading={loading}
                max={state.events.length}
                onChange={setReplayIndex}
                value={Math.min(replayIndex, state.events.length)}
              />
            ) : null}
          </div>
        </section>

        <aside className="tc-detail">
          <EvidenceDetail setupGaps={setupGaps} toolCall={state.selectedToolCall} />
        </aside>
      </div>
    </main>
  )
}

function SetupGuide({
  demoCreating,
  hasCompletedInvestigation,
  hasInvestigations,
  onCreateDemo,
}: {
  demoCreating: boolean
  hasCompletedInvestigation: boolean
  hasInvestigations: boolean
  onCreateDemo: () => void
}) {
  const [account, setAccount] = useState<WorkspaceAccountResponse | null>(null)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [accountSaving, setAccountSaving] = useState(false)
  const [apiKeys, setApiKeys] = useState<WorkspaceApiKey[]>([])
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null)
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [apiKeyLoading, setApiKeyLoading] = useState(true)
  const [apiKeyCreating, setApiKeyCreating] = useState(false)
  const [apiKeyName, setApiKeyName] = useState("Default integration key")
  const [integrations, setIntegrations] = useState<WorkspaceIntegration[]>([])
  const [integrationError, setIntegrationError] = useState<string | null>(null)
  const [integrationSaving, setIntegrationSaving] = useState<IntegrationProvider | null>(null)
  const [githubOwner, setGithubOwner] = useState("")
  const [githubRepo, setGithubRepo] = useState("")
  const [githubToken, setGithubToken] = useState("")
  const [prometheusEndpoint, setPrometheusEndpoint] = useState("")
  const [lokiEndpoint, setLokiEndpoint] = useState("")
  const [tempoEndpoint, setTempoEndpoint] = useState("")

  useEffect(() => {
    void loadWorkspaceAccount(setAccount, setAccountError)
    void loadWorkspaceApiKeys(setApiKeys, setApiKeyError, setApiKeyLoading)
    void loadWorkspaceIntegrations(setIntegrations, setIntegrationError)
  }, [])

  const curlExample = `curl -sS "${apiBaseUrl}/investigations" \\
  -H "Authorization: Bearer ${createdApiKey ?? "$ARGUS_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "incidentId": "checkout-latency-2026-05-24",
    "triggerPayload": {
      "summary": "Checkout p95 latency increased during payment authorization.",
      "service": "checkout",
      "serviceName": "checkout",
      "severity": "high",
      "environment": "prod",
      "start": "2026-05-24T06:00:00.000Z",
      "end": "2026-05-24T06:30:00.000Z",
      "deployRef": "2026.05.24",
      "commitSha": "abc1234",
      "codePattern": "payment_authorize"
    }
  }'`
  const hasApiKey = createdApiKey !== null || apiKeys.some((key) => key.status === "active")
  const hasGithub = integrations.some(
    (integration) => integration.provider === "github" && integration.status === "connected",
  )
  const checklistItems = [
    {
      complete: hasApiKey,
      detail: hasApiKey
        ? "Workspace can create investigations through the API."
        : "Create a workspace API key for alerts, scripts, or webhook adapters.",
      title: "Create an API key",
    },
    {
      complete: hasGithub,
      detail: hasGithub
        ? "GitHub code and deploy evidence is available."
        : "Connect GitHub when you want deploy and code context in reports.",
      title: "Connect GitHub",
    },
    {
      complete: hasInvestigations,
      detail: hasInvestigations
        ? "Your workspace has at least one investigation."
        : "Create a safe demo investigation to see the workflow without production credentials.",
      title: "Create first investigation",
    },
    {
      complete: hasCompletedInvestigation,
      detail: hasCompletedInvestigation
        ? "A completed report is ready to review."
        : "Open the first completed investigation to inspect the report, evidence, and dissent.",
      title: "Review first report",
    },
  ]

  return (
    <div className="tc-stack">
      <section className="tc-card tc-setup-card">
        <div className="tc-card-header">
          <h2>Connect Argus</h2>
          <span>workspace onboarding</span>
        </div>
        <div className="tc-setup-hero">
          <div>
            <p className="tc-kicker">minimum path</p>
            <h2>Send incidents to the API, then review the investigation here.</h2>
            <p>
              Argus works best when your alerting system, deploy script, or on-call runbook creates
              an investigation as soon as an incident starts.
            </p>
          </div>
          <div className="tc-api-card">
            <span>API base URL</span>
            <code>{apiBaseUrl}</code>
          </div>
        </div>
      </section>

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>First-Run Checklist</h2>
          <span>{checklistItems.filter((item) => item.complete).length} / 4 complete</span>
        </div>
        <div className="tc-first-run-grid">
          <div className="tc-first-run-list">
            {checklistItems.map((item, index) => (
              <div
                className={`tc-first-run-item ${item.complete ? "tc-first-run-item-complete" : ""}`}
                key={item.title}
              >
                <span>{item.complete ? "✓" : index + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="tc-first-run-action">
            <p className="tc-kicker">safe demo path</p>
            <h3>Start with one demo incident.</h3>
            <p>
              This creates a clearly labeled demo investigation using sample incident context. It
              proves the workflow without connecting production monitoring first.
            </p>
            <button
              className="tc-primary-button"
              disabled={demoCreating}
              onClick={onCreateDemo}
              type="button"
            >
              {demoCreating ? "Creating demo..." : "Create demo investigation"}
            </button>
          </div>
        </div>
      </section>

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>Known v1 Limits</h2>
          <span>read before relying on a report</span>
        </div>
        <div className="tc-setup-grid">
          <SetupColumn
            items={[
              "Missing GitHub, Prometheus, Loki, Tempo, or feature-flag data becomes a setup gap and lowers confidence.",
              "Low-confidence or unresolved-dissent reports should be treated as investigation guidance, not final proof.",
              "Replay is read-only in v1; branching or manually resolving dissent is not implemented yet.",
            ]}
            title="Report trust"
          />
          <SetupColumn
            items={[
              "Browser integrations should use this dashboard or a backend adapter; the API is not open-CORS for arbitrary web apps.",
              "Workspace API keys are shown once and should be rotated after demos or accidental exposure.",
              "Team invites, SSO, automated billing, and production tenant administration are still beta gaps.",
            ]}
            title="Access and tenancy"
          />
          <SetupColumn
            items={[
              "Hosted free Render services can cold start or sleep; use paid instances before serious customer operations.",
              "Migrations and Inngest sync are operator-run launch steps, not automatic self-service flows.",
              "Rollback is documented, but disaster recovery is not fully automated in v1.",
            ]}
            title="Operations"
          />
        </div>
      </section>

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>Account Controls</h2>
          <span>usage, cost, and launch billing guardrails</span>
        </div>
        {accountError ? <div className="tc-inline-error">{accountError}</div> : null}
        {account ? (
          <div className="tc-account-grid">
            <div className="tc-account-status">
              <span>Workspace</span>
              <strong>{account.account.name}</strong>
              <em className={`tc-status-${account.account.status}`}>{account.account.status}</em>
              <p>{account.policy[account.account.status]}</p>
              <label>
                Account status
                <select
                  disabled={accountSaving}
                  onChange={(event) =>
                    void updateWorkspaceAccountStatus(
                      event.target.value as WorkspaceAccountResponse["account"]["status"],
                      setAccount,
                      setAccountError,
                      setAccountSaving,
                    )
                  }
                  value={account.account.status}
                >
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>
            </div>
            <UsageMetric label="Investigations" value={account.usage.investigationCount} />
            <UsageMetric
              label="Failed runs"
              value={account.usage.failedInvestigationCount}
              tone={account.usage.failedInvestigationCount > 0 ? "danger" : "default"}
            />
            <UsageMetric
              label="Tokens"
              value={account.usage.inputTokens + account.usage.outputTokens}
            />
            <UsageMetric
              label="Estimated cost"
              value={`$${account.usage.totalCostUsd.toFixed(4)}`}
            />
            <UsageMetric
              label="Avg workflow"
              value={
                account.usage.averageWorkflowLatencyMs === null
                  ? "-"
                  : formatDurationMs(account.usage.averageWorkflowLatencyMs)
              }
            />
          </div>
        ) : null}
      </section>

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>Workspace API Keys</h2>
          <span>shown once, stored hashed</span>
        </div>
        <div className="tc-api-key-panel">
          <div className="tc-api-key-create">
            <label htmlFor="api-key-name">Key name</label>
            <div>
              <input
                id="api-key-name"
                onChange={(event) => setApiKeyName(event.target.value)}
                value={apiKeyName}
              />
              <button
                disabled={apiKeyCreating}
                onClick={() =>
                  void createWorkspaceApiKey(
                    apiKeyName,
                    setApiKeys,
                    setCreatedApiKey,
                    setApiKeyError,
                    setApiKeyCreating,
                  )
                }
                type="button"
              >
                {apiKeyCreating ? "Creating..." : "Create API key"}
              </button>
            </div>
            <p>
              Use this key from alerting systems, scripts, or customer services that create
              investigations. It can create investigations only inside this workspace.
            </p>
          </div>
          {createdApiKey ? (
            <div className="tc-api-key-secret">
              <strong>Copy this API key now. It will not be shown again.</strong>
              <code>{createdApiKey}</code>
            </div>
          ) : null}
          {apiKeyError ? <div className="tc-inline-error">{apiKeyError}</div> : null}
          <div className="tc-api-key-list">
            {apiKeyLoading ? <p>Loading API keys...</p> : null}
            {!apiKeyLoading && apiKeys.length === 0 ? <p>No workspace API keys yet.</p> : null}
            {apiKeys.map((key) => (
              <div className="tc-api-key-row" key={key.id}>
                <div>
                  <strong>{key.name}</strong>
                  <span>
                    {key.keyPrefix} · {key.status}
                    {key.lastUsedAt ? ` · last used ${formatRelativeTime(key.lastUsedAt)}` : ""}
                  </span>
                </div>
                {key.status === "active" ? (
                  <div className="tc-api-key-actions">
                    <button
                      onClick={() =>
                        void rotateWorkspaceApiKey(
                          key.id,
                          setApiKeys,
                          setCreatedApiKey,
                          setApiKeyError,
                        )
                      }
                      type="button"
                    >
                      Rotate
                    </button>
                    <button
                      onClick={() => void revokeWorkspaceApiKey(key.id, setApiKeys, setApiKeyError)}
                      type="button"
                    >
                      Revoke
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>Create Investigation API</h2>
          <span>copy into a script, runbook, or webhook adapter</span>
        </div>
        <pre className="tc-code-sample">{curlExample}</pre>
      </section>

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>Evidence Integrations</h2>
          <span>stored per workspace, not global deployment env</span>
        </div>
        <div className="tc-integration-panel">
          <IntegrationStatusList integrations={integrations} />
          {integrationError ? <div className="tc-inline-error">{integrationError}</div> : null}
          <div className="tc-integration-grid">
            <form
              className="tc-integration-form"
              onSubmit={(event) => {
                event.preventDefault()
                void saveWorkspaceIntegration(
                  "github",
                  { owner: githubOwner, repo: githubRepo },
                  githubToken,
                  setIntegrations,
                  setIntegrationError,
                  setIntegrationSaving,
                )
              }}
            >
              <h3>GitHub code and deploys</h3>
              <input
                aria-label="GitHub owner"
                onChange={(event) => setGithubOwner(event.target.value)}
                placeholder="owner"
                value={githubOwner}
              />
              <input
                aria-label="GitHub repo"
                onChange={(event) => setGithubRepo(event.target.value)}
                placeholder="repo"
                value={githubRepo}
              />
              <input
                aria-label="GitHub token"
                onChange={(event) => setGithubToken(event.target.value)}
                placeholder="token shown never again"
                type="password"
                value={githubToken}
              />
              <button disabled={integrationSaving === "github"} type="submit">
                {integrationSaving === "github" ? "Saving..." : "Save GitHub"}
              </button>
            </form>
            <EndpointIntegrationForm
              endpoint={prometheusEndpoint}
              label="Prometheus endpoint"
              onEndpointChange={setPrometheusEndpoint}
              onSave={(endpoint) =>
                saveWorkspaceIntegration(
                  "prometheus",
                  { endpoint },
                  null,
                  setIntegrations,
                  setIntegrationError,
                  setIntegrationSaving,
                )
              }
              provider="prometheus"
              saving={integrationSaving}
              title="Prometheus metrics"
            />
            <EndpointIntegrationForm
              endpoint={lokiEndpoint}
              label="Loki endpoint"
              onEndpointChange={setLokiEndpoint}
              onSave={(endpoint) =>
                saveWorkspaceIntegration(
                  "loki",
                  { endpoint },
                  null,
                  setIntegrations,
                  setIntegrationError,
                  setIntegrationSaving,
                )
              }
              provider="loki"
              saving={integrationSaving}
              title="Loki logs"
            />
            <EndpointIntegrationForm
              endpoint={tempoEndpoint}
              label="Tempo endpoint"
              onEndpointChange={setTempoEndpoint}
              onSave={(endpoint) =>
                saveWorkspaceIntegration(
                  "tempo",
                  { endpoint },
                  null,
                  setIntegrations,
                  setIntegrationError,
                  setIntegrationSaving,
                )
              }
              provider="tempo"
              saving={integrationSaving}
              title="Tempo traces"
            />
          </div>
        </div>
      </section>

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>What Credentials Mean</h2>
          <span>do not mix customer keys with operator secrets</span>
        </div>
        <div className="tc-setup-grid">
          <SetupColumn
            items={[
              "Workspace API key generated in this setup panel.",
              "Incident payload fields from alerts or runbooks.",
              "Optional evidence credentials if you connect their observability tools.",
            ]}
            title="Customer or company provides"
          />
          <SetupColumn
            items={[
              "Anthropic key used by the worker to run agents.",
              "Inngest keys used by the workflow runtime.",
              "Postgres URL and Render service secrets.",
            ]}
            title="Operator service owns"
          />
          <SetupColumn
            items={[
              "API URL and dashboard URL for this workspace.",
              "API key creation, revocation, and rotation through this dashboard.",
              "Which integrations are connected and which are setup gaps.",
            ]}
            title="You hand off"
          />
        </div>
      </section>

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>Recommended Integration Order</h2>
          <span>start simple, add evidence depth later</span>
        </div>
        <div className="tc-steps">
          <Step number="1" title="Manual or scripted API call">
            Create investigations from the dashboard form, curl, or an internal runbook.
          </Step>
          <Step number="2" title="Monitoring alert webhook">
            Adapt Grafana, PagerDuty, Datadog, or another alert source to call the same API.
          </Step>
          <Step number="3" title="Deploy and code context">
            Send deploy refs, commit SHAs, and code patterns so Argus can reason about changes.
          </Step>
          <Step number="4" title="Observability backends">
            Connect metrics, logs, and traces so evidence chains become stronger and confidence
            rises.
          </Step>
        </div>
      </section>
    </div>
  )
}

function UsageMetric({
  label,
  tone = "default",
  value,
}: {
  label: string
  tone?: "default" | "danger"
  value: number | string
}) {
  return (
    <div className={`tc-usage-metric tc-usage-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SetupColumn({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="tc-setup-column">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function IntegrationStatusList({ integrations }: { integrations: WorkspaceIntegration[] }) {
  const providers: IntegrationProvider[] = ["github", "prometheus", "loki", "tempo"]

  return (
    <div className="tc-integration-status-list">
      {providers.map((provider) => {
        const integration = integrations.find((item) => item.provider === provider)
        const connected = integration?.status === "connected"

        return (
          <div className="tc-integration-status" key={provider}>
            <span className={connected ? "tc-dot-green" : "tc-dot-gray"} />
            <strong>{integrationLabel(provider)}</strong>
            <em>{connected ? "connected" : "not connected"}</em>
            {integration?.secretKeyHint ? <code>{integration.secretKeyHint}</code> : null}
          </div>
        )
      })}
    </div>
  )
}

function EndpointIntegrationForm({
  endpoint,
  label,
  onEndpointChange,
  onSave,
  provider,
  saving,
  title,
}: {
  endpoint: string
  label: string
  onEndpointChange: Dispatch<SetStateAction<string>>
  onSave: (endpoint: string) => Promise<void>
  provider: IntegrationProvider
  saving: IntegrationProvider | null
  title: string
}) {
  return (
    <form
      className="tc-integration-form"
      onSubmit={(event) => {
        event.preventDefault()
        void onSave(endpoint)
      }}
    >
      <h3>{title}</h3>
      <input
        aria-label={label}
        onChange={(event) => onEndpointChange(event.target.value)}
        placeholder="https://..."
        value={endpoint}
      />
      <button disabled={saving === provider} type="submit">
        {saving === provider ? "Saving..." : `Save ${integrationLabel(provider)}`}
      </button>
    </form>
  )
}

function OperatorConsole({
  diagnostic,
  inbox,
  loading,
  onRefresh,
  selectedInvestigation,
}: {
  diagnostic: DashboardDiagnostic | null
  inbox: InvestigationSummary[]
  loading: boolean
  onRefresh: () => void
  selectedInvestigation: InvestigationSummary | null
}) {
  const [account, setAccount] = useState<WorkspaceAccountResponse | null>(null)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [supportRequestId, setSupportRequestId] = useState<string | null>(null)

  useEffect(() => {
    void loadWorkspaceAccount(setAccount, setAccountError, setSupportRequestId)
  }, [])

  const health = buildOperatorHealth(inbox, account)
  const supportInvestigation = selectedInvestigation ?? failedInvestigationsCandidate(inbox)
  const stuckInvestigations = getStuckInvestigations(inbox)
  const failedInvestigations = inbox
    .filter((investigation) => investigation.status === "failed")
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 5)

  return (
    <div className="tc-stack">
      <section className="tc-card tc-operator-card">
        <div className="tc-card-header">
          <div>
            <h2>Support Console</h2>
            <p>Operator visibility for workspace health, stuck runs, failures, and cost.</p>
          </div>
          <span>{health.status}</span>
        </div>
        {accountError ? <Notice tone="amber">{accountError}</Notice> : null}
        {actionMessage ? <Notice tone="amber">{actionMessage}</Notice> : null}
        <div className="tc-operator-grid">
          <OperatorMetric label="Workspace" value={account?.account.name ?? "Loading"} />
          <OperatorMetric label="Health" tone={health.tone} value={health.status} />
          <OperatorMetric
            label="Failed runs"
            tone={failedInvestigations.length > 0 ? "danger" : "default"}
            value={`${account?.usage.failedInvestigationCount ?? failedInvestigations.length}`}
          />
          <OperatorMetric
            label="Stuck running"
            tone={stuckInvestigations.length > 0 ? "danger" : "default"}
            value={`${stuckInvestigations.length}`}
          />
          <OperatorMetric
            label="Estimated cost"
            value={`$${(account?.usage.totalCostUsd ?? sumInvestigationCost(inbox)).toFixed(4)}`}
          />
          <OperatorMetric
            label="Avg workflow"
            value={
              account?.usage.averageWorkflowLatencyMs === null ||
              account?.usage.averageWorkflowLatencyMs === undefined
                ? "-"
                : formatDurationMs(account.usage.averageWorkflowLatencyMs)
            }
          />
        </div>
      </section>

      <SupportReferences
        account={account}
        diagnostic={diagnostic}
        investigation={supportInvestigation}
        requestId={supportRequestId}
      />

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>Recent Error Candidates</h2>
          <span>{failedInvestigations.length} failed</span>
        </div>
        {loading ? <PanelSkeleton title="Loading support data" /> : null}
        {!loading && failedInvestigations.length === 0 ? (
          <EmptyState
            title="No failed investigations"
            body="Failures will appear here with incident IDs and last update time."
          />
        ) : null}
        <div className="tc-operator-list">
          {failedInvestigations.map((investigation) => (
            <SupportInvestigationRow
              actionBusyId={actionBusyId}
              investigation={investigation}
              key={investigation.id}
              onActionMessage={setActionMessage}
              onCancel={onRefresh}
              onSetActionBusyId={setActionBusyId}
              reason="failed workflow"
            />
          ))}
        </div>
      </section>

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>Stuck Investigations</h2>
          <span>{stuckInvestigations.length} older than 30m</span>
        </div>
        {stuckInvestigations.length === 0 ? (
          <EmptyState
            title="No stuck investigations"
            body="Running investigations older than 30 minutes will appear here."
          />
        ) : null}
        <div className="tc-operator-list">
          {stuckInvestigations.map((investigation) => (
            <SupportInvestigationRow
              actionBusyId={actionBusyId}
              investigation={investigation}
              key={investigation.id}
              onActionMessage={setActionMessage}
              onCancel={onRefresh}
              onSetActionBusyId={setActionBusyId}
              reason="running longer than 30 minutes"
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function SupportReferences({
  account,
  diagnostic,
  investigation,
  requestId,
}: {
  account: WorkspaceAccountResponse | null
  diagnostic: DashboardDiagnostic | null
  investigation: InvestigationSummary | null
  requestId: string | null
}) {
  const rows = [
    {
      label: "Workspace ID",
      value: account?.account.id ?? "loading",
    },
    {
      label: "Investigation ID",
      value: investigation?.id ?? "select an investigation",
    },
    {
      label: "API request ID",
      value: requestId ?? "loading",
    },
    {
      label: "Inngest app",
      value: "argus",
    },
    {
      label: "Inngest function",
      value: "investigation-requested",
    },
    {
      label: "Inngest event",
      value: "investigation.requested",
    },
  ]

  return (
    <section className="tc-card">
      <div className="tc-card-header">
        <div>
          <h2>Support References</h2>
          <p>Use these IDs to search API logs, worker logs, Inngest runs, and customer reports.</p>
        </div>
        <span>{investigation ? "linked" : "no investigation"}</span>
      </div>
      <div className="tc-support-reference-grid">
        {rows.map((row) => (
          <SupportReferenceRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
      {diagnostic ? (
        <div className="tc-support-diagnostic">
          <strong>Latest customer error diagnostic</strong>
          <dl>
            <div>
              <dt>Source</dt>
              <dd>{diagnostic.source}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{diagnostic.status ?? "unknown"}</dd>
            </div>
            <div>
              <dt>Request ID</dt>
              <dd>{diagnostic.requestId ?? "missing"}</dd>
            </div>
            <div>
              <dt>Upstream</dt>
              <dd>{diagnostic.upstreamError ?? "none"}</dd>
            </div>
          </dl>
          <p>{diagnostic.message}</p>
        </div>
      ) : null}
      <div className="tc-support-lookup">
        <strong>Inngest run lookup</strong>
        <code>
          app=argus function=investigation-requested event=investigation.requested investigationId=
          {investigation?.id ?? "unknown"}
        </code>
        <span>
          v1 does not persist the provider run ID yet. Search Inngest by function and event payload
          investigationId.
        </span>
      </div>
    </section>
  )
}

function SupportReferenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="tc-support-reference-row">
      <span>{label}</span>
      <code>{value}</code>
      <button
        className="tc-secondary-button"
        disabled={value === "loading" || value === "select an investigation"}
        onClick={() => void navigator.clipboard?.writeText(value)}
        type="button"
      >
        Copy
      </button>
    </div>
  )
}

function OperatorMetric({
  label,
  tone = "default",
  value,
}: {
  label: string
  tone?: "danger" | "default" | "warning"
  value: string
}) {
  return (
    <div className={`tc-operator-metric tc-operator-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SupportInvestigationRow({
  actionBusyId,
  investigation,
  onActionMessage,
  onCancel,
  onSetActionBusyId,
  reason,
}: {
  actionBusyId: string | null
  investigation: InvestigationSummary
  onActionMessage: Dispatch<SetStateAction<string | null>>
  onCancel: () => void
  onSetActionBusyId: Dispatch<SetStateAction<string | null>>
  reason: string
}) {
  const isCancelling = actionBusyId === investigation.id

  return (
    <div className="tc-support-row">
      <div>
        <strong>{investigation.incidentId}</strong>
        <span>{reason}</span>
      </div>
      <div>
        <StatusBadge status={investigation.status} />
        <span>{phaseLabel(investigation.currentPhase)}</span>
        <span>{relativeTime(investigation.updatedAt)}</span>
      </div>
      <div className="tc-support-actions">
        {investigation.status === "running" ? (
          <button
            aria-label={`Cancel ${investigation.incidentId}`}
            className="tc-secondary-button"
            disabled={isCancelling}
            onClick={() =>
              void cancelInvestigationFromSupport(
                investigation.id,
                investigation.incidentId,
                onActionMessage,
                onSetActionBusyId,
                onCancel,
              )
            }
            type="button"
          >
            {isCancelling ? "Cancelling..." : "Cancel"}
          </button>
        ) : (
          <>
            <button
              aria-label={`Retry ${investigation.incidentId}`}
              className="tc-secondary-button"
              disabled
              title="Retry is not enabled until workflow replay can create a new durable run."
              type="button"
            >
              Retry
            </button>
            <button
              aria-label={`Resolve ${investigation.incidentId}`}
              className="tc-secondary-button"
              disabled
              title="Resolve is not enabled until operator resolution state is persisted."
              type="button"
            >
              Resolve
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Step({
  children,
  number,
  title,
}: {
  children: React.ReactNode
  number: string
  title: string
}) {
  return (
    <div className="tc-step">
      <span>{number}</span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  )
}

function InvestigationHeader({
  investigation,
  loading,
  report,
}: {
  investigation: InvestigationSummary | null
  loading: boolean
  report: InvestigationReport | null
}) {
  if (!investigation) {
    return (
      <section className="tc-incident-header">
        <div>
          <p className="tc-kicker">incident</p>
          <h1>No investigation selected</h1>
        </div>
      </section>
    )
  }

  return (
    <section className="tc-incident-header">
      <div className="tc-incident-title">
        <p className="tc-kicker">
          incident / <strong>{investigation.incidentId}</strong> / run #{investigation.currentRound}
        </p>
        <h1>{titleFromIncidentId(investigation.incidentId)}</h1>
        {isSmokeInvestigation(investigation.incidentId) ? (
          <p className="tc-subtle-note">
            Test investigation from deployment validation. Use it to inspect the product shape, not
            as a real customer incident.
          </p>
        ) : null}
      </div>
      <div className="tc-header-actions">
        <button className="tc-secondary-button" disabled type="button">
          Export
        </button>
        <button className="tc-secondary-button" disabled type="button">
          Share
        </button>
        <div className="tc-disabled-action">
          <button
            aria-describedby={`rerun-feedback-copy-${investigation.id}`}
            className="tc-primary-button"
            disabled
            type="button"
          >
            Re-run with feedback
          </button>
          <p id={`rerun-feedback-copy-${investigation.id}`}>
            Not in v1. Create a new investigation with updated context instead.
          </p>
        </div>
      </div>
      <div className="tc-incident-metrics">
        <Metric label="status" value={<StatusBadge status={investigation.status} />} />
        <Metric label="investigation step" value={phaseLabel(investigation.currentPhase)} />
        <Metric label="run" value={`${investigation.currentRound}`} />
        <Metric
          label="confidence"
          value={formatScore(report?.confidence ?? investigation.confidence)}
        />
        <Metric label="updated" value={relativeTime(investigation.updatedAt)} />
        <Metric label="state" value={loading ? "syncing" : "ready"} />
      </div>
    </section>
  )
}

function ReportView({
  artifacts,
  loading,
  onOpenEvidence,
  report,
  setupGaps,
}: {
  artifacts: InvestigationArtifacts | null
  loading: boolean
  onOpenEvidence: (citation: Citation) => void
  report: NonNullable<InvestigationReport["finalReport"]> | null
  setupGaps: string[]
}) {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)

  if (!report) {
    if (loading) {
      return <PanelSkeleton title="Loading report" />
    }

    return <EmptyState title="No final report yet" body="The report appears after verdict." />
  }

  const primaryCitation = report.evidence_chain[0] ?? null
  const actionPlan = buildActionPlan(report, setupGaps)
  const shareFormats = buildShareFormats(report, actionPlan, setupGaps, artifacts)

  function copyShareFormat(format: ShareFormat) {
    void copyTextToClipboard(format.body).then(() => {
      setCopiedFormat(format.id)
      window.setTimeout(() => setCopiedFormat(null), 2500)
    })
  }

  return (
    <div className="tc-stack">
      <section className="tc-card tc-share-card">
        <div className="tc-card-header">
          <div>
            <h2>Share Report</h2>
            <p>
              Copy the review-ready summary into the incident channel, email, or postmortem doc.
            </p>
          </div>
          {copiedFormat ? <span>{shareLabel(copiedFormat)} copied</span> : <span>ready</span>}
        </div>
        <div className="tc-share-actions">
          {shareFormats.map((format) =>
            format.id === "postmortem" ? (
              <button
                className="tc-secondary-button"
                key={format.id}
                onClick={() => downloadTextFile("argus-postmortem.md", format.body)}
                type="button"
              >
                Export postmortem
              </button>
            ) : (
              <button
                className="tc-secondary-button"
                key={format.id}
                onClick={() => copyShareFormat(format)}
                type="button"
              >
                Copy {format.label}
              </button>
            ),
          )}
        </div>
      </section>

      <section className="tc-card tc-review-card">
        <div className="tc-card-header">
          <h2>Review Brief</h2>
          <span>customer-ready incident artifact</span>
        </div>
        <div className="tc-review-hero">
          <div>
            <p className="tc-kicker">most likely cause</p>
            <h3>{report.verdict}</h3>
            {primaryCitation ? (
              <CitationLink citation={primaryCitation} onOpen={onOpenEvidence}>
                Open supporting evidence
              </CitationLink>
            ) : null}
          </div>
          <div className="tc-confidence-card">
            <span>Evidence confidence</span>
            <strong>{formatScore(report.confidence)}</strong>
            <div className="tc-confidence-track">
              <div style={{ width: `${Math.round(report.confidence * 100)}%` }} />
            </div>
            <p>{confidenceLabel(report.confidence)}</p>
          </div>
        </div>
        <div className="tc-review-grid">
          <ReviewBlock eyebrow="confidence" title="Why this score">
            {confidenceExplanation(
              report.confidence,
              report.evidence_chain.length,
              setupGaps.length,
            )}
          </ReviewBlock>
          <ReviewBlock eyebrow="evidence" title={`${report.evidence_chain.length} cited claims`}>
            <span>Every major conclusion below is backed by a clickable evidence row.</span>
            {primaryCitation ? (
              <CitationLink citation={primaryCitation} onOpen={onOpenEvidence}>
                Inspect primary citation
              </CitationLink>
            ) : null}
          </ReviewBlock>
          <ReviewBlock eyebrow="dissent" title="Alternative explanation check">
            {report.dissent_considered}
          </ReviewBlock>
          <ReviewBlock eyebrow="action" title="Recommended next action">
            {report.recommended_fix.immediate}
          </ReviewBlock>
        </div>
        {setupGaps.length > 0 ? (
          <div className="tc-setup-gaps">
            <strong>Setup gaps reducing confidence</strong>
            <ul>
              {setupGaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>Timeline</h2>
          <span>{report.timeline.length} events</span>
        </div>
        <div className="tc-timeline">
          {report.timeline.map((item) => {
            const citation = citationForSourceIds(report.evidence_chain, item.source_ids)

            return (
              <div className="tc-timeline-row" key={`${item.timestamp}-${item.text}`}>
                <time>{formatTime(item.timestamp)}</time>
                <div>
                  <p>{item.text}</p>
                  {citation ? (
                    <CitationLink citation={citation} onOpen={onOpenEvidence}>
                      Inspect timeline source
                    </CitationLink>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>Evidence Chain</h2>
          <span>{report.evidence_chain.length} cited</span>
        </div>
        <EvidenceRows citations={report.evidence_chain} onOpen={onOpenEvidence} />
      </section>

      <section className="tc-card tc-dissent-card">
        <div className="tc-card-header">
          <h2>Alternative Explanation Check</h2>
          <span>{artifacts?.dissentEntries.length ?? 0} entries</span>
        </div>
        <p>{report.dissent_considered}</p>
        <div className="tc-dissent-list">
          {artifacts?.dissentEntries.map((entry) => (
            <div className="tc-dissent-entry" key={entry.id}>
              <strong>Counsel</strong>
              <p>{entry.counterArgument}</p>
              <span>
                strength {entry.dissentStrength} · {entry.resolved ? "resolved" : "unresolved"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="tc-card">
        <div className="tc-card-header">
          <h2>Action Plan</h2>
          <span>immediate · verification · prevention</span>
        </div>
        <div className="tc-fix-grid">
          {actionPlan.map((action) => (
            <div key={action.title}>
              <strong>{action.title}</strong>
              <p>{action.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function LiveView({
  connectionState,
  events,
  loading,
}: {
  connectionState: LiveConnectionState
  events: InvestigationEvent[]
  loading: boolean
}) {
  if (events.length === 0) {
    return (
      <div className="tc-stack">
        {connectionState === "reconnecting" ? (
          <Notice tone="amber">
            Live updates are reconnecting. The investigation is still saved; refresh is not needed.
          </Notice>
        ) : null}
        {loading ? (
          <PanelSkeleton title="Loading live events" />
        ) : (
          <EmptyState title="No live events loaded" body={liveConnectionCopy(connectionState)} />
        )}
      </div>
    )
  }

  return (
    <section className="tc-card">
      <div className="tc-card-header">
        <h2>Live View</h2>
        <span>
          {events.length} events · {liveConnectionLabel(connectionState)}
        </span>
      </div>
      {connectionState === "reconnecting" ? (
        <Notice tone="amber">
          Live updates are reconnecting. New workflow events will appear when the stream resumes.
        </Notice>
      ) : null}
      <div className="tc-event-list">
        {events.map((event) => (
          <EventRow event={event} key={event.sequence} />
        ))}
      </div>
    </section>
  )
}

function EvidenceView({
  citations,
  loading,
  onOpen,
}: {
  citations: Citation[]
  loading: boolean
  onOpen: (citation: Citation) => void
}) {
  if (citations.length === 0) {
    if (loading) {
      return <PanelSkeleton title="Loading cited evidence" />
    }

    return (
      <EmptyState title="No cited evidence yet" body="Citations appear after Reporter output." />
    )
  }

  return (
    <section className="tc-card">
      <div className="tc-card-header">
        <h2>Evidence</h2>
        <span>{citations.length} cited · click a row to inspect</span>
      </div>
      <div className="tc-evidence-table">
        {citations.map((citation, index) => (
          <button
            className="tc-evidence-row"
            key={`${citation.sourceType}-${citation.sourceId}-${citation.claim}`}
            onClick={() => onOpen(citation)}
            type="button"
          >
            <span>{index + 1}</span>
            <strong>{citation.claim}</strong>
            <em>{citation.relevance}</em>
            <code>{citation.sourceType}</code>
          </button>
        ))}
      </div>
    </section>
  )
}

function ReplayView({
  events,
  loading,
  max,
  onChange,
  value,
}: {
  events: InvestigationEvent[]
  loading: boolean
  max: number
  onChange: (value: number) => void
  value: number
}) {
  if (loading) {
    return <PanelSkeleton title="Loading replay events" />
  }

  if (events.length === 0 && max === 0) {
    return (
      <EmptyState
        title="No replay events yet"
        body="Replay becomes useful after the worker records investigation events."
      />
    )
  }

  const latestReplayEvent = events.at(-1) ?? null

  return (
    <section className="tc-card">
      <div className="tc-card-header">
        <h2>Replay</h2>
        <span>
          {value} / {max}
        </span>
      </div>
      <div className="tc-replay-summary">
        <div>
          <p className="tc-kicker">read-only replay</p>
          <h3>
            {latestReplayEvent ? replayHeadline(latestReplayEvent) : "Move the slider to replay"}
          </h3>
          <p>
            Replay reveals the investigation sequence from the first recorded event to the selected
            point. Raw event payloads stay collapsed unless you need audit detail.
          </p>
        </div>
        <div className="tc-replay-meter">
          <strong>{events.length}</strong>
          <span>events visible</span>
        </div>
      </div>
      <input
        aria-label="Replay event position"
        className="tc-range"
        max={max}
        min={0}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
      <div className="tc-event-list tc-event-list-replay">
        {events.length > 0 ? (
          events.map((event) => <ReplayEventRow event={event} key={event.sequence} />)
        ) : (
          <div className="tc-replay-empty">
            <strong>Start of investigation</strong>
            <p>No events are included at this replay position.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function EvidenceDetail({
  setupGaps,
  toolCall,
}: {
  setupGaps: string[]
  toolCall: ToolCallArtifact | null
}) {
  if (!toolCall) {
    return (
      <aside className="tc-detail-empty">
        <p className="tc-kicker">evidence</p>
        <h2>Select evidence</h2>
        <p>Click a cited evidence row to inspect the proof behind a report claim.</p>
        {setupGaps.length > 0 ? (
          <div className="tc-detail-hint">
            <strong>Current setup gaps</strong>
            <ul>
              {setupGaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    )
  }

  return (
    <div className="tc-detail-content">
      <p className="tc-kicker">evidence / tool_call</p>
      <h2>{toolCall.toolName}</h2>
      <div className="tc-chip-row">
        <span>completed</span>
        <span>{toolCall.expertName}</span>
        <span>{toolCall.durationMs} ms</span>
      </div>

      <DetailSection title="Call metadata">
        <dl className="tc-detail-list">
          <dt>tool</dt>
          <dd>{toolCall.toolName}</dd>
          <dt>step key</dt>
          <dd>{toolCall.stepKey}</dd>
          <dt>expert</dt>
          <dd>{toolCall.expertName}</dd>
          <dt>created</dt>
          <dd>{formatTime(toolCall.createdAt)}</dd>
          <dt>duration</dt>
          <dd>{toolCall.durationMs} ms</dd>
        </dl>
      </DetailSection>
      <DetailSection title="Source context">
        <EvidenceSourceContext value={toolCall.result} />
      </DetailSection>
      <DetailSection title="Arguments">
        <JsonBlock value={toolCall.arguments} />
      </DetailSection>
      <DetailSection title="Result">
        <JsonBlock value={toolCall.result} />
      </DetailSection>
      <DetailSection title="Error">
        <pre className="tc-error-block">
          {toolCall.error ? explainToolError(toolCall.error) : "- none -"}
        </pre>
      </DetailSection>
    </div>
  )
}

function EvidenceSourceContext({ value }: { value: JsonValue }) {
  const results = evidenceResults(value)

  if (results.length === 0) {
    return (
      <div className="tc-source-context">
        <p>No normalized source context was recorded for this tool call.</p>
      </div>
    )
  }

  return (
    <div className="tc-source-context">
      {results.map((result) => (
        <div className="tc-source-row" key={`${result.kind}-${result.status}`}>
          <div>
            <strong>{result.kind}</strong>
            <span>{sourceContextSummary(result)}</span>
          </div>
          <span className={`tc-source-status tc-source-status-${result.status}`}>
            {result.gapType ?? result.status}
          </span>
        </div>
      ))}
    </div>
  )
}

type EvidenceSourceResult = {
  configured?: boolean
  gapType?: string
  kind: string
  status: string
}

function evidenceResults(value: JsonValue): EvidenceSourceResult[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return []
  }

  const rawResults = value.results
  if (!Array.isArray(rawResults)) {
    return []
  }

  return rawResults.flatMap((rawResult) => {
    if (!rawResult || typeof rawResult !== "object" || Array.isArray(rawResult)) {
      return []
    }

    const kind = rawResult.kind
    const status = rawResult.status
    if (typeof kind !== "string" || typeof status !== "string") {
      return []
    }

    const result: EvidenceSourceResult = { kind, status }
    if (typeof rawResult.gapType === "string") {
      result.gapType = rawResult.gapType
    }
    if (typeof rawResult.configured === "boolean") {
      result.configured = rawResult.configured
    }

    return [result]
  })
}

function sourceContextSummary(result: EvidenceSourceResult): string {
  if (result.status === "ok") {
    return result.configured === false ? "fallback source captured" : "source data captured"
  }

  if (result.gapType === "not_configured") {
    return "integration is not connected"
  }

  if (result.gapType === "zero_results") {
    return "integration returned no matching evidence"
  }

  if (result.gapType === "result_too_large") {
    return "query matched too much data; narrow service, path, or time window"
  }

  if (result.gapType === "query_failed") {
    return "integration was connected but query failed"
  }

  return "source status recorded"
}

function CreateInvestigationForm({
  creating,
  error,
  onCancel,
  onCreate,
}: {
  creating: boolean
  error: string | null
  onCancel: () => void
  onCreate: (request: CreateInvestigationRequest) => void
}) {
  const now = new Date()
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60_000)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const incidentId = String(form.get("incidentId") ?? "").trim()
    const service = String(form.get("service") ?? "").trim()
    const environment = String(form.get("environment") ?? "").trim()
    const severity = String(form.get("severity") ?? "").trim()
    const summary = String(form.get("summary") ?? "").trim()
    const start = String(form.get("start") ?? "").trim()
    const end = String(form.get("end") ?? "").trim()
    const deployRef = String(form.get("deployRef") ?? "").trim()
    const commitSha = String(form.get("commitSha") ?? "").trim()
    const logQuery = String(form.get("logQuery") ?? "").trim()
    const metricQuery = String(form.get("metricQuery") ?? "").trim()
    const codePattern = String(form.get("codePattern") ?? "").trim()
    const featureFlagContext = String(form.get("featureFlagContext") ?? "").trim()

    const triggerPayload: Record<string, JsonValue> = {
      environment,
      service,
      serviceName: service,
      severity,
      summary,
    }

    if (start) {
      triggerPayload.start = new Date(start).toISOString()
    }

    if (end) {
      triggerPayload.end = new Date(end).toISOString()
    }

    if (deployRef) {
      triggerPayload.deployRef = deployRef
    }

    if (commitSha) {
      triggerPayload.commitSha = commitSha
    }

    if (logQuery) {
      triggerPayload.logQuery = logQuery
    }

    if (metricQuery) {
      triggerPayload.metricQuery = metricQuery
    }

    if (codePattern) {
      triggerPayload.codePattern = codePattern
    }

    if (featureFlagContext) {
      triggerPayload.featureFlagContext = { note: featureFlagContext }
    }

    onCreate({
      incidentId,
      triggerPayload,
    })
  }

  return (
    <form className="tc-create-form" onSubmit={handleSubmit}>
      <div className="tc-create-form-header">
        <strong>New investigation</strong>
        <span>Single-company v1</span>
      </div>
      {error ? <Notice tone="red">{error}</Notice> : null}
      <label>
        Incident ID
        <input name="incidentId" placeholder="checkout-latency-2026-05-24" required />
      </label>
      <label>
        Summary
        <textarea
          name="summary"
          placeholder="Checkout p95 latency increased during payment authorization."
          required
          rows={3}
        />
      </label>
      <div className="tc-form-grid">
        <label>
          Service
          <input name="service" placeholder="checkout" required />
        </label>
        <label>
          Environment
          <input defaultValue="prod" name="environment" required />
        </label>
      </div>
      <div className="tc-form-grid">
        <label>
          Severity
          <select defaultValue="high" name="severity" required>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <label>
          Code pattern
          <input name="codePattern" placeholder="payment_authorize" />
        </label>
      </div>
      <div className="tc-date-grid">
        <label>
          Start
          <input
            defaultValue={formatDateTimeLocal(thirtyMinutesAgo)}
            name="start"
            type="datetime-local"
          />
        </label>
        <label>
          End
          <input defaultValue={formatDateTimeLocal(now)} name="end" type="datetime-local" />
        </label>
      </div>
      <details>
        <summary>Optional evidence hints</summary>
        <label>
          Deploy ref
          <input name="deployRef" placeholder="2026.05.24" />
        </label>
        <label>
          Commit SHA
          <input name="commitSha" placeholder="abc1234" />
        </label>
        <label>
          Log query
          <input name="logQuery" placeholder='{service="checkout"}' />
        </label>
        <label>
          Metric query
          <input name="metricQuery" placeholder="histogram_quantile(0.95, sum(rate(...)))" />
        </label>
        <label>
          Feature flag context
          <input name="featureFlagContext" placeholder="payment rollout enabled for all users" />
        </label>
      </details>
      <div className="tc-form-actions">
        <button
          className="tc-secondary-button"
          disabled={creating}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button className="tc-primary-button" disabled={creating} type="submit">
          {creating ? "Creating..." : "Start investigation"}
        </button>
      </div>
    </form>
  )
}

function ReviewBlock({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode
  eyebrow: string
  title: string
}) {
  return (
    <div className="tc-review-block">
      <span>{eyebrow}</span>
      <strong>{title}</strong>
      <div className="tc-review-block-body">{children}</div>
    </div>
  )
}

function CitationLink({
  children,
  citation,
  onOpen,
}: {
  children: React.ReactNode
  citation: Citation
  onOpen: (citation: Citation) => void
}) {
  return (
    <button className="tc-citation-link" onClick={() => onOpen(citation)} type="button">
      {children}
      <span>{citation.sourceType}</span>
    </button>
  )
}

function citationForSourceIds(citations: Citation[], sourceIds: string[]): Citation | null {
  return citations.find((citation) => sourceIds.includes(citation.sourceId)) ?? null
}

function buildActionPlan(
  report: NonNullable<InvestigationReport["finalReport"]>,
  setupGaps: string[],
) {
  return [
    {
      body: report.recommended_fix.immediate,
      title: "Immediate",
    },
    {
      body:
        setupGaps.length > 0
          ? "Verify the fix against the cited evidence, then close the listed setup gaps before treating this as fully confirmed."
          : "Verify the fix against the cited evidence, then rerun the investigation or alert check to confirm the symptom clears.",
      title: "Verification",
    },
    {
      body: report.recommended_fix.long_term,
      title: "Prevention",
    },
  ]
}

function buildShareFormats(
  report: NonNullable<InvestigationReport["finalReport"]>,
  actionPlan: ReturnType<typeof buildActionPlan>,
  setupGaps: string[],
  artifacts: InvestigationArtifacts | null,
): ShareFormat[] {
  const evidenceLines = report.evidence_chain
    .slice(0, 5)
    .map((citation, index) => `${index + 1}. ${citation.claim} [${citation.relevance}]`)
  const dissentCount = artifacts?.dissentEntries.length ?? 0
  const confidence = formatScore(report.confidence)
  const setupGapText =
    setupGaps.length > 0
      ? `Setup gaps: ${setupGaps.join("; ")}`
      : "Setup gaps: none blocking confidence."
  const actionText = actionPlan.map((action) => `${action.title}: ${action.body}`).join("\n")

  return [
    {
      body: [
        `Argus incident review (${confidence} confidence)`,
        `Cause: ${report.verdict}`,
        `Evidence: ${evidenceLines.join(" | ")}`,
        `Dissent: ${report.dissent_considered}`,
        `Next: ${actionPlan[0]?.body ?? report.recommended_fix.immediate}`,
      ].join("\n"),
      id: "slack",
      label: "Slack summary",
    },
    {
      body: [
        "Team,",
        "",
        `Argus completed the incident review with ${confidence} evidence confidence.`,
        "",
        `Most likely cause: ${report.verdict}`,
        "",
        `Recommended next action: ${actionPlan[0]?.body ?? report.recommended_fix.immediate}`,
        "",
        `Dissent considered: ${report.dissent_considered}`,
        "",
        setupGapText,
      ].join("\n"),
      id: "email",
      label: "email update",
    },
    {
      body: [
        "# Argus Incident Review",
        "",
        "## Most likely cause",
        "",
        report.verdict,
        "",
        "## Confidence",
        "",
        `${confidence} - ${confidenceLabel(report.confidence)}`,
        "",
        "## Evidence chain",
        "",
        ...evidenceLines.map((line) => `- ${line}`),
        "",
        "## Timeline",
        "",
        ...report.timeline.map((item) => `- ${formatTime(item.timestamp)} - ${item.text}`),
        "",
        "## Dissent considered",
        "",
        `${report.dissent_considered} (${dissentCount} recorded entries)`,
        "",
        "## Action plan",
        "",
        actionText,
        "",
        "## Setup gaps",
        "",
        setupGaps.length > 0 ? setupGaps.map((gap) => `- ${gap}`).join("\n") : "- None recorded",
      ].join("\n"),
      id: "postmortem",
      label: "postmortem notes",
    },
  ]
}

function shareLabel(id: string) {
  if (id === "slack") {
    return "Slack summary"
  }
  if (id === "email") {
    return "Email update"
  }
  return "Postmortem notes"
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.append(textarea)
  textarea.select()
  document.execCommand("copy")
  textarea.remove()
}

function downloadTextFile(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function EvidenceRows({
  citations,
  onOpen,
}: {
  citations: Citation[]
  onOpen?: (citation: Citation) => void
}) {
  return (
    <div className="tc-evidence-table">
      {citations.map((citation, index) =>
        onOpen ? (
          <button
            className="tc-evidence-row"
            key={`${citation.sourceType}-${citation.sourceId}-${citation.claim}`}
            onClick={() => onOpen(citation)}
            type="button"
          >
            <span>{index + 1}</span>
            <strong>{citation.claim}</strong>
            <em>{citation.relevance}</em>
            <code>{citation.sourceType}</code>
          </button>
        ) : (
          <div
            className="tc-evidence-row tc-evidence-row-static"
            key={`${citation.sourceType}-${citation.sourceId}-${citation.claim}`}
          >
            <span>{index + 1}</span>
            <strong>{citation.claim}</strong>
            <em>{citation.relevance}</em>
            <code>{citation.sourceType}</code>
          </div>
        ),
      )}
    </div>
  )
}

function EventRow({ event }: { event: InvestigationEvent }) {
  return (
    <div className="tc-event-row">
      <div>
        <span className={`tc-event-dot tc-event-dot-${event.eventType}`} />
        <strong>{humanize(event.eventType)}</strong>
        <code>{event.eventType}</code>
        <code>#{event.sequence}</code>
      </div>
      <pre>{JSON.stringify(event.payload, null, 2)}</pre>
    </div>
  )
}

function ReplayEventRow({ event }: { event: InvestigationEvent }) {
  return (
    <div className="tc-replay-row">
      <div className="tc-replay-row-marker">
        <span className={`tc-event-dot tc-event-dot-${event.eventType}`} />
        <code>#{event.sequence}</code>
      </div>
      <div>
        <strong>{replayHeadline(event)}</strong>
        <p>{replayDescription(event)}</p>
        <details>
          <summary>Raw event payload</summary>
          <pre>{JSON.stringify(event.payload, null, 2)}</pre>
        </details>
      </div>
    </div>
  )
}

function replayHeadline(event: InvestigationEvent): string {
  if (event.eventType === "phase_changed") {
    return "Investigation moved phase"
  }

  if (event.eventType === "agent_started") {
    return "Agent started work"
  }

  if (event.eventType === "agent_completed") {
    return "Agent completed work"
  }

  if (event.eventType === "tool_started") {
    return "Evidence collection started"
  }

  if (event.eventType === "tool_completed") {
    return "Evidence collection completed"
  }

  if (event.eventType === "artifact_written") {
    return "Report artifact written"
  }

  if (event.eventType === "error") {
    return "Workflow recorded an error"
  }

  return humanize(event.eventType)
}

function replayDescription(event: InvestigationEvent): string {
  const payload = event.payload
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return `Recorded at ${formatTime(event.createdAt)}.`
  }

  const from = typeof payload.from === "string" ? payload.from : null
  const to = typeof payload.to === "string" ? payload.to : null
  const agentRole = typeof payload.agentRole === "string" ? payload.agentRole : null
  const expertName = typeof payload.expertName === "string" ? payload.expertName : null
  const toolName = typeof payload.toolName === "string" ? payload.toolName : null
  const artifactType = typeof payload.artifactType === "string" ? payload.artifactType : null

  if (from && to) {
    return `Phase changed from ${phaseLabel(from)} to ${phaseLabel(to)}.`
  }

  if (agentRole) {
    return `${humanize(agentRole)} updated the investigation record.`
  }

  if (expertName && toolName) {
    return `${humanize(expertName)} used ${toolName} to gather cited evidence.`
  }

  if (artifactType) {
    return `${humanize(artifactType)} became available for review.`
  }

  return `Recorded at ${formatTime(event.createdAt)}.`
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="tc-detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="tc-json-block">{JSON.stringify(value, null, 2)}</pre>
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="tc-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StatusBadge({ status }: { status: InvestigationSummary["status"] }) {
  return <span className={`tc-status-badge tc-status-${status}`}>{statusLabel(status)}</span>
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: "green" | "neutral" }) {
  return <span className={`tc-status-pill tc-status-pill-${tone}`}>{children}</span>
}

function ScoreBar({ value }: { value: number | null }) {
  const width = value === null ? 0 : Math.round(value * 100)
  return (
    <span className="tc-score-bar">
      <span style={{ width: `${width}%` }} />
    </span>
  )
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button className={active ? "tc-tab-active" : ""} onClick={onClick} type="button">
      {children}
    </button>
  )
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button className={active ? "tc-filter-active" : ""} onClick={onClick} type="button">
      {children}
    </button>
  )
}

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <div className="tc-empty">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  )
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "amber" | "red" }) {
  return <div className={`tc-notice tc-notice-${tone}`}>{children}</div>
}

function CustomerErrorReference({ diagnostic }: { diagnostic: DashboardDiagnostic }) {
  return (
    <div className="tc-error-reference">
      <strong>Support reference</strong>
      <span>
        Give support request ID <code>{diagnostic.requestId ?? "unavailable"}</code> and source{" "}
        <code>{diagnostic.source}</code>.
      </span>
    </div>
  )
}

function InboxSkeleton() {
  const rows = ["one", "two", "three", "four", "five"]

  return (
    <div className="tc-inbox-skeleton" aria-label="Loading investigations">
      {rows.map((row) => (
        <div className="tc-inbox-row tc-skeleton-row" key={row}>
          <span className="tc-skeleton-dot" />
          <div className="tc-inbox-row-main">
            <span className="tc-skeleton-line tc-skeleton-line-strong" />
            <span className="tc-skeleton-line" />
            <span className="tc-skeleton-line tc-skeleton-line-short" />
          </div>
        </div>
      ))}
    </div>
  )
}

function PanelSkeleton({ title }: { title: string }) {
  return (
    <section className="tc-card tc-panel-skeleton" aria-busy="true">
      <div className="tc-card-header">
        <h2>{title}</h2>
        <span>syncing</span>
      </div>
      <div>
        <span className="tc-skeleton-line tc-skeleton-line-strong" />
        <span className="tc-skeleton-line" />
        <span className="tc-skeleton-line" />
        <span className="tc-skeleton-line tc-skeleton-line-short" />
      </div>
    </section>
  )
}

async function refreshInbox(
  setState: Dispatch<SetStateAction<DashboardState>>,
  setError: Dispatch<SetStateAction<string | null>>,
  setLoading: Dispatch<SetStateAction<boolean>>,
  setDiagnostic?: Dispatch<SetStateAction<DashboardDiagnostic | null>>,
): Promise<void> {
  setLoading(true)
  try {
    const inbox = await loadInbox()
    setState((current) => ({
      ...current,
      inbox,
      selectedId:
        current.selectedId && inbox.some((investigation) => investigation.id === current.selectedId)
          ? current.selectedId
          : (inbox[0]?.id ?? null),
    }))
    setError(null)
    setDiagnostic?.(null)
  } catch (caught) {
    setError(formatCustomerError(caught, "Failed to load inbox"))
    setDiagnostic?.(toDashboardDiagnostic(caught, "inbox_load"))
  } finally {
    setLoading(false)
  }
}

async function loadInbox(): Promise<InvestigationSummary[]> {
  return fetchJson<InvestigationSummary[]>("/api/investigations")
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path)

  if (!response.ok) {
    throw await createDashboardHttpError(response, path)
  }

  return response.json() as Promise<T>
}

async function postJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { method: "POST" })

  if (!response.ok) {
    throw await createDashboardHttpError(response, path)
  }

  return response.json() as Promise<T>
}

async function cancelInvestigationFromSupport(
  investigationId: string,
  incidentId: string,
  setActionMessage: Dispatch<SetStateAction<string | null>>,
  setActionBusyId: Dispatch<SetStateAction<string | null>>,
  onCancel: () => void,
): Promise<void> {
  setActionBusyId(investigationId)
  setActionMessage(null)
  try {
    await postJson<InvestigationSummary>(`/api/investigations/${investigationId}/cancel`)
    setActionMessage(`Cancel requested for ${incidentId}.`)
    onCancel()
  } catch (caught) {
    setActionMessage(caught instanceof Error ? caught.message : "Failed to cancel investigation.")
  } finally {
    setActionBusyId(null)
  }
}

async function fetchOptional<T>(path: string): Promise<T | null> {
  const response = await fetch(`/api${path}`)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw await createDashboardHttpError(response, path)
  }

  return response.json() as Promise<T>
}

async function createDashboardHttpError(
  response: Response,
  source: string,
): Promise<DashboardHttpError> {
  const body = (await response.json().catch(() => null)) as {
    error?: string
    message?: string
    upstream?: { error?: string; message?: string }
  } | null
  const message = body?.message ?? body?.upstream?.message ?? userFacingHttpError(response.status)

  return new DashboardHttpError(message, {
    message,
    requestId: response.headers.get("x-argus-request-id"),
    source,
    status: response.status,
    upstreamError: body?.error ?? body?.upstream?.error ?? null,
  })
}

async function loadWorkspaceAccount(
  setAccount: Dispatch<SetStateAction<WorkspaceAccountResponse | null>>,
  setAccountError: Dispatch<SetStateAction<string | null>>,
  setRequestId?: Dispatch<SetStateAction<string | null>>,
): Promise<void> {
  try {
    const response = await fetch("/api/workspace/account")

    if (!response.ok) {
      throw new Error(userFacingHttpError(response.status))
    }

    setRequestId?.(response.headers.get("x-argus-request-id"))
    setAccount((await response.json()) as WorkspaceAccountResponse)
    setAccountError(null)
  } catch (caught) {
    setAccountError(caught instanceof Error ? caught.message : "Failed to load account usage")
  }
}

async function updateWorkspaceAccountStatus(
  status: WorkspaceAccountResponse["account"]["status"],
  setAccount: Dispatch<SetStateAction<WorkspaceAccountResponse | null>>,
  setAccountError: Dispatch<SetStateAction<string | null>>,
  setAccountSaving: Dispatch<SetStateAction<boolean>>,
): Promise<void> {
  setAccountSaving(true)
  try {
    const response = await fetch("/api/workspace/account", {
      body: JSON.stringify({ status }),
      headers: {
        "content-type": "application/json",
      },
      method: "PUT",
    })

    if (!response.ok) {
      throw new Error(userFacingHttpError(response.status))
    }

    const account = (await response.json()) as WorkspaceAccountResponse["account"]
    setAccount((current) => (current ? { ...current, account } : current))
    setAccountError(null)
  } catch (caught) {
    setAccountError(caught instanceof Error ? caught.message : "Failed to update account status")
  } finally {
    setAccountSaving(false)
  }
}

async function loadWorkspaceApiKeys(
  setApiKeys: Dispatch<SetStateAction<WorkspaceApiKey[]>>,
  setApiKeyError: Dispatch<SetStateAction<string | null>>,
  setApiKeyLoading: Dispatch<SetStateAction<boolean>>,
): Promise<void> {
  setApiKeyLoading(true)
  try {
    setApiKeys(await fetchJson<WorkspaceApiKey[]>("/api/workspace/api-keys"))
    setApiKeyError(null)
  } catch (caught) {
    setApiKeyError(caught instanceof Error ? caught.message : "Failed to load API keys")
  } finally {
    setApiKeyLoading(false)
  }
}

async function createWorkspaceApiKey(
  name: string,
  setApiKeys: Dispatch<SetStateAction<WorkspaceApiKey[]>>,
  setCreatedApiKey: Dispatch<SetStateAction<string | null>>,
  setApiKeyError: Dispatch<SetStateAction<string | null>>,
  setApiKeyCreating: Dispatch<SetStateAction<boolean>>,
): Promise<void> {
  setApiKeyCreating(true)
  try {
    const response = await fetch("/api/workspace/api-keys", {
      body: JSON.stringify({ name }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    })

    if (!response.ok) {
      throw new Error(userFacingHttpError(response.status))
    }

    const body = (await response.json()) as { apiKey: string; key: WorkspaceApiKey }
    setCreatedApiKey(body.apiKey)
    setApiKeys((current) => [body.key, ...current])
    setApiKeyError(null)
  } catch (caught) {
    setApiKeyError(caught instanceof Error ? caught.message : "Failed to create API key")
  } finally {
    setApiKeyCreating(false)
  }
}

async function revokeWorkspaceApiKey(
  id: string,
  setApiKeys: Dispatch<SetStateAction<WorkspaceApiKey[]>>,
  setApiKeyError: Dispatch<SetStateAction<string | null>>,
): Promise<void> {
  try {
    const response = await fetch(`/api/workspace/api-keys/${id}/revoke`, { method: "POST" })

    if (!response.ok) {
      throw new Error(userFacingHttpError(response.status))
    }

    setApiKeys((current) =>
      current.map((key) =>
        key.id === id
          ? { ...key, status: "revoked" as const, revokedAt: new Date().toISOString() }
          : key,
      ),
    )
    setApiKeyError(null)
  } catch (caught) {
    setApiKeyError(caught instanceof Error ? caught.message : "Failed to revoke API key")
  }
}

async function loadWorkspaceIntegrations(
  setIntegrations: Dispatch<SetStateAction<WorkspaceIntegration[]>>,
  setIntegrationError: Dispatch<SetStateAction<string | null>>,
): Promise<void> {
  try {
    setIntegrations(await fetchJson<WorkspaceIntegration[]>("/api/workspace/integrations"))
    setIntegrationError(null)
  } catch (caught) {
    setIntegrationError(caught instanceof Error ? caught.message : "Failed to load integrations")
  }
}

async function saveWorkspaceIntegration(
  provider: IntegrationProvider,
  config: Record<string, unknown>,
  secret: string | null,
  setIntegrations: Dispatch<SetStateAction<WorkspaceIntegration[]>>,
  setIntegrationError: Dispatch<SetStateAction<string | null>>,
  setIntegrationSaving: Dispatch<SetStateAction<IntegrationProvider | null>>,
): Promise<void> {
  setIntegrationSaving(provider)
  try {
    const response = await fetch(`/api/workspace/integrations/${provider}`, {
      body: JSON.stringify({
        config,
        ...(secret && secret.trim().length > 0 ? { secret } : {}),
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "PUT",
    })

    if (!response.ok) {
      throw new Error(userFacingHttpError(response.status))
    }

    const integration = (await response.json()) as WorkspaceIntegration
    setIntegrations((current) => [
      integration,
      ...current.filter((item) => item.provider !== integration.provider),
    ])
    setIntegrationError(null)
  } catch (caught) {
    setIntegrationError(caught instanceof Error ? caught.message : "Failed to save integration")
  } finally {
    setIntegrationSaving(null)
  }
}

async function rotateWorkspaceApiKey(
  id: string,
  setApiKeys: Dispatch<SetStateAction<WorkspaceApiKey[]>>,
  setCreatedApiKey: Dispatch<SetStateAction<string | null>>,
  setApiKeyError: Dispatch<SetStateAction<string | null>>,
): Promise<void> {
  try {
    const response = await fetch(`/api/workspace/api-keys/${id}/rotate`, { method: "POST" })

    if (!response.ok) {
      throw new Error(userFacingHttpError(response.status))
    }

    const body = (await response.json()) as {
      apiKey: string
      key: WorkspaceApiKey
      revokedKeyId: string
    }
    setCreatedApiKey(body.apiKey)
    setApiKeys((current) => [
      body.key,
      ...current.map((key) =>
        key.id === body.revokedKeyId
          ? { ...key, status: "revoked" as const, revokedAt: new Date().toISOString() }
          : key,
      ),
    ])
    setApiKeyError(null)
  } catch (caught) {
    setApiKeyError(caught instanceof Error ? caught.message : "Failed to rotate API key")
  }
}

function integrationLabel(provider: IntegrationProvider): string {
  const labels: Record<IntegrationProvider, string> = {
    github: "GitHub",
    launchdarkly: "LaunchDarkly",
    loki: "Loki",
    prometheus: "Prometheus",
    tempo: "Tempo",
  }

  return labels[provider]
}

async function openEvidence(
  citation: Citation,
  investigationId: string | null,
  setState: Dispatch<SetStateAction<DashboardState>>,
  setError: Dispatch<SetStateAction<string | null>>,
  setDiagnostic: Dispatch<SetStateAction<DashboardDiagnostic | null>>,
): Promise<void> {
  if (citation.sourceType !== "tool_call" || !investigationId) {
    return
  }

  try {
    const toolCall = await fetchJson<ToolCallArtifact>(
      `/api/investigations/${investigationId}/tool-calls/${citation.sourceId}`,
    )
    setState((current) => ({ ...current, selectedToolCall: toolCall }))
    setError(null)
    setDiagnostic(null)
  } catch (caught) {
    setError(formatCustomerError(caught, "Failed to load evidence"))
    setDiagnostic(toDashboardDiagnostic(caught, "evidence_load"))
  }
}

function formatRelativeTime(value: string): string {
  const elapsedMs = Date.now() - new Date(value).getTime()
  const elapsedMinutes = Math.max(Math.floor(elapsedMs / 60_000), 0)

  if (elapsedMinutes < 1) {
    return "just now"
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  return `${elapsedHours}h ago`
}

function formatDurationMs(value: number): string {
  if (value < 1000) {
    return `${value}ms`
  }

  const seconds = value / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }

  return `${Math.round(seconds / 60)}m`
}

function liveConnectionLabel(state: LiveConnectionState): string {
  const labels: Record<LiveConnectionState, string> = {
    closed: "closed",
    connected: "live",
    connecting: "connecting",
    idle: "waiting",
    reconnecting: "reconnecting",
  }

  return labels[state]
}

function liveConnectionCopy(state: LiveConnectionState): string {
  if (state === "reconnecting") {
    return "Argus is reconnecting to live workflow updates. Existing report and evidence remain available."
  }

  if (state === "connecting") {
    return "Argus is opening the live workflow stream for this investigation."
  }

  return "Workflow progress appears here as Argus investigates the incident."
}

function formatCustomerError(caught: unknown, fallback: string): string {
  if (caught instanceof DashboardHttpError) {
    const reference = caught.diagnostic.requestId
      ? ` Reference ID: ${caught.diagnostic.requestId}.`
      : " Reference ID unavailable."
    return `${caught.message}${reference}`
  }

  return caught instanceof Error ? caught.message : fallback
}

function toDashboardDiagnostic(caught: unknown, source: string): DashboardDiagnostic {
  if (caught instanceof DashboardHttpError) {
    return { ...caught.diagnostic, source }
  }

  return {
    message: caught instanceof Error ? caught.message : "Unknown dashboard error",
    requestId: null,
    source,
    status: null,
    upstreamError: null,
  }
}

function userFacingHttpError(status: number): string {
  if (status === 401 || status === 403) {
    return "Your session cannot access this workspace. Sign in again or check workspace access."
  }

  if (status === 404) {
    return "Argus could not find that investigation or report yet."
  }

  if (status === 429) {
    return "Argus is rate limiting this workspace. Wait a moment and retry."
  }

  if (status >= 500) {
    return "Argus could not reach the API service. Retry in a moment; the investigation data is still safe."
  }

  return `Argus request failed with status ${status}.`
}

async function createInvestigation(
  request: CreateInvestigationRequest,
  actions: {
    setActiveTab: Dispatch<SetStateAction<DashboardTab>>
    setCreating: Dispatch<SetStateAction<boolean>>
    setDiagnostic: Dispatch<SetStateAction<DashboardDiagnostic | null>>
    setError: Dispatch<SetStateAction<string | null>>
    setFormError: Dispatch<SetStateAction<string | null>>
    setShowCreateForm: Dispatch<SetStateAction<boolean>>
    setState: Dispatch<SetStateAction<DashboardState>>
  },
): Promise<void> {
  actions.setCreating(true)
  actions.setFormError(null)
  try {
    const response = await fetch("/api/investigations", {
      body: JSON.stringify(request),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    })

    const responseBody = (await response.json().catch(() => null)) as
      | InvestigationSummary
      | {
          error?: string
          message?: string
          upstream?: { error?: string; message?: string }
        }
      | null

    if (!response.ok) {
      const message =
        responseBody && "message" in responseBody && responseBody.message
          ? responseBody.message
          : userFacingHttpError(response.status)
      throw new DashboardHttpError(message, {
        message,
        requestId: response.headers.get("x-argus-request-id"),
        source: "investigation_create",
        status: response.status,
        upstreamError:
          responseBody && "error" in responseBody && typeof responseBody.error === "string"
            ? responseBody.error
            : null,
      })
    }

    const investigation = responseBody as InvestigationSummary
    actions.setState((current) => ({
      ...current,
      artifacts: null,
      events: [],
      inbox: [investigation, ...current.inbox.filter((item) => item.id !== investigation.id)],
      report: null,
      selectedId: investigation.id,
      selectedToolCall: null,
    }))
    actions.setActiveTab("live")
    actions.setShowCreateForm(false)
    actions.setError(null)
    actions.setDiagnostic(null)
  } catch (caught) {
    actions.setFormError(formatCustomerError(caught, "Could not create investigation"))
    actions.setDiagnostic(toDashboardDiagnostic(caught, "investigation_create"))
  } finally {
    actions.setCreating(false)
  }
}

function createDemoInvestigationRequest(): CreateInvestigationRequest {
  const end = new Date()
  const start = new Date(end.getTime() - 30 * 60_000)
  const suffix = end.toISOString().replace(/[-:.]/g, "").slice(0, 15)

  return {
    incidentId: `demo-checkout-latency-${suffix}`,
    triggerPayload: {
      codePattern: "payment_authorize",
      demo: true,
      end: end.toISOString(),
      environment: "demo",
      service: "checkout",
      serviceName: "checkout",
      severity: "medium",
      start: start.toISOString(),
      summary:
        "Demo incident: checkout p95 latency increased during payment authorization after a deploy.",
      testData: true,
    },
  }
}

function getInboxStats(inbox: InvestigationSummary[]) {
  return {
    total: inbox.length,
    running: inbox.filter((investigation) => investigation.status === "running").length,
    completed: inbox.filter((investigation) => investigation.status === "completed").length,
    failed: inbox.filter((investigation) => investigation.status === "failed").length,
  }
}

function buildOperatorHealth(
  inbox: InvestigationSummary[],
  account: WorkspaceAccountResponse | null,
): { status: string; tone: "danger" | "default" | "warning" } {
  if (account?.account.status === "disabled") {
    return { status: "disabled", tone: "danger" }
  }
  if (account?.account.status === "suspended") {
    return { status: "suspended", tone: "warning" }
  }
  if (getStuckInvestigations(inbox).length > 0) {
    return { status: "stuck runs", tone: "danger" }
  }
  if (
    inbox.some((investigation) => investigation.status === "failed") ||
    (account?.usage.failedInvestigationCount ?? 0) > 0
  ) {
    return { status: "failures", tone: "warning" }
  }
  return { status: "healthy", tone: "default" }
}

function getStuckInvestigations(inbox: InvestigationSummary[]) {
  const stuckAfterMs = 30 * 60 * 1000
  const now = Date.now()

  return inbox
    .filter(
      (investigation) =>
        investigation.status === "running" &&
        now - Date.parse(investigation.updatedAt) > stuckAfterMs,
    )
    .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt))
}

function failedInvestigationsCandidate(inbox: InvestigationSummary[]) {
  return (
    inbox
      .filter((investigation) => investigation.status === "failed")
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ??
    inbox[0] ??
    null
  )
}

function sumInvestigationCost(inbox: InvestigationSummary[]) {
  return inbox.reduce((sum, investigation) => sum + (investigation.totalCostUsd ?? 0), 0)
}

function upsertEvent(
  events: InvestigationEvent[],
  event: InvestigationEvent,
): InvestigationEvent[] {
  const existing = events.filter((candidate) => candidate.sequence !== event.sequence)
  return [...existing, event].sort((left, right) => left.sequence - right.sequence)
}

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : value.toFixed(2)
}

function statusLabel(status: InvestigationSummary["status"]) {
  const labels: Record<InvestigationSummary["status"], string> = {
    cancelled: "cancelled",
    completed: "completed",
    failed: "needs setup",
    running: "investigating",
  }

  return labels[status]
}

function phaseLabel(phase: string) {
  const labels: Record<string, string> = {
    done: "report ready",
    trace: "gathering evidence",
    triage: "planning",
    verdict: "writing report",
  }

  return labels[phase] ?? phase
}

function isSmokeInvestigation(incidentId: string) {
  const normalized = incidentId.toLowerCase()
  return (
    normalized.startsWith("smoke-") ||
    normalized.startsWith("dashboard-smoke-") ||
    normalized.includes("smoke")
  )
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.75) {
    return "high confidence"
  }

  if (confidence >= 0.5) {
    return "medium confidence"
  }

  return "low confidence"
}

function confidenceExplanation(
  confidence: number,
  citedEvidenceCount: number,
  setupGapCount: number,
) {
  const label = confidenceLabel(confidence)
  const evidenceText =
    citedEvidenceCount === 1
      ? "1 cited evidence item"
      : `${citedEvidenceCount} cited evidence items`
  const gapText =
    setupGapCount === 0
      ? "No setup gaps were detected in the final report."
      : `${setupGapCount} setup gap${setupGapCount === 1 ? "" : "s"} reduced confidence.`

  return `Argus marked this as ${label} based on ${evidenceText}. ${gapText}`
}

function getSetupGaps(
  report: NonNullable<InvestigationReport["finalReport"]>,
  artifacts: InvestigationArtifacts | null,
) {
  const candidates = [
    report.verdict,
    report.dissent_considered,
    report.recommended_fix.immediate,
    report.recommended_fix.long_term,
    ...report.evidence_chain.map((citation) => citation.claim),
    ...(artifacts?.dissentEntries.map((entry) => entry.counterArgument) ?? []),
  ].join(" ")

  const lower = candidates.toLowerCase()
  const gaps: string[] = []

  if (lower.includes("prometheus") || lower.includes("metric")) {
    gaps.push("Metrics backend is not connected or did not return enough data.")
  }

  if (lower.includes("loki") || lower.includes("log ")) {
    gaps.push("Logs backend is not connected or did not return enough data.")
  }

  if (lower.includes("tempo") || lower.includes("trace")) {
    gaps.push("Trace backend is not connected or did not return enough data.")
  }

  if (lower.includes("github") || lower.includes("code search") || lower.includes("deploy")) {
    gaps.push("Code or deploy evidence is missing or unavailable.")
  }

  if (lower.includes("feature flag") || lower.includes("flag")) {
    gaps.push("Feature flag evidence is not connected.")
  }

  return [...new Set(gaps)]
}

function explainToolError(error: string) {
  if (error.includes("ENOENT") || error.toLowerCase().includes("spawn rg")) {
    return "Code search could not run in this deployment. Connect a searchable repository or ensure ripgrep is available."
  }

  if (error.toLowerCase().includes("missing") || error.toLowerCase().includes("not configured")) {
    return "This evidence source is not configured yet. Argus recorded it as a setup gap instead of inventing evidence."
  }

  return error
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function relativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const diffMinutes = Math.round(diffMs / 60_000)

  if (diffMinutes < 1) {
    return "just now"
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }

  const hours = Math.round(diffMinutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

function formatDateTimeLocal(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16)
}

function titleFromIncidentId(incidentId: string) {
  return incidentId.replaceAll("-", " ")
}

function humanize(value: string) {
  return value.replaceAll("_", " ")
}
