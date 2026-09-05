 # Argus — Build Plan

> A multi-agent system that investigates production incidents through adversarial dialectical reasoning. Director orchestrates, Experts gather evidence, Critic verifies, Counsel argues against, Reporter writes the verdict.

---

## 1. What we're building (the one-paragraph pitch)

Argus receives a production incident (a trace ID, an alert, a failed agent run), spins up a team of LLM-powered agents that investigate it like a courtroom — Experts gather evidence from real observability systems, a Critic scores findings for credibility, a Counsel actively argues against the Director's hypothesis, and a Reporter generates a final incident report with citations and a confidence score. Confidence is computed from evidence support, Critic credibility, and unresolved Counsel dissent rather than from LLM self-belief alone. The system runs on a durable workflow engine, persists structured artifacts and replayable events in Postgres (not raw chat history as the primary state), and is itself fully traced with OpenTelemetry so it can investigate its own failures.

---

## 2. Why this project

- **Real, unsolved problem**: AIOps tools today are pattern-matching anomaly detectors that say "look here" without showing reasoning. Argus produces verifiable, auditable incident reports a senior engineer can trust.
- **Maps directly to day job**: I work on observability and tracing at Mastra. This project *is* observability + tracing + agents fused. Ideas flow both ways.
- **Architecturally non-trivial**: 5 agent roles, 4 context channels, 3 phases, durable workflows, real eval harness. Not a weekend hack.
- **Defensible novel contribution**: The Counsel agent and Dissent Log are not in Slack's published architecture and not in any open-source agent framework. Adversarial dialectic between Director and Counsel, with confidence penalized by unresolved dissent and bounded by evidence quality, is the original idea.
- **Dogfoods on itself**: Argus is instrumented with OpenTelemetry; Argus can investigate its own failed runs.

---

## 3. Architecture (the agent system)

### 3.1 The five roles

| Role | Model alias / tier | Job | Why this tier |
|------|------------|-----|---------------|
| **Director** | `director.primary` / strongest reasoning model | Strategy: decides what questions to ask, which Experts to engage, when to advance phases, when to conclude | Open-ended reasoning, few calls, high stakes |
| **Experts** (Trace, Log, Metric, Deploy, Code) | `expert.cheap` / low-cost tool-use model | Run tools, query observability systems, summarize raw evidence | High volume, mechanical, cost matters |
| **Critic** | `critic.balanced` / mid-tier reasoning model | Verifies each Expert finding against the actual cited evidence; scores credibility 0.0–1.0 | Bounded judgment with evidence in hand |
| **Counsel** | `counsel.balanced` / mid-tier reasoning model | Adversary: actively argues the opposite of the Director's hypothesis; writes Dissent Log | Bounded reasoning, focused on counter-arguments |
| **Reporter** | `reporter.primary` / strongest writing-reasoning model | Called once at Verdict phase: synthesizes Journal + Review + Timeline + Dissent into the final report | One-shot, high-quality narrative output |

### 3.2 The three phases

```
TRIAGE → TRACE → VERDICT
```

- **Triage**: Director broadcasts to all Experts. Each does initial scan. Critic scores. Director decides: deepen, pivot, or conclude.
- **Trace**: Director targets specific Experts based on Triage findings. Counsel begins active dissent. Iterates over multiple rounds.
- **Verdict**: Director declares hypothesis. Counsel makes final dissent. Reporter generates the report. Investigation closes.

### 3.3 The four context channels (the shared brain)

Between rounds, **only these four artifacts propagate forward**. No raw message history.

| Artifact | Producer | Consumers | Contents |
|----------|----------|-----------|----------|
| **Journal** | Director | All agents | Typed entries: `decision`, `observation`, `finding`, `question`, `hypothesis`, `action`, `counter_evidence` |
| **Review** | Critic | All agents | Per-finding credibility scores 0.0–1.0 with citations |
| **Timeline** | Critic | All agents | Chronological narrative of confirmed events + confidence score + evidence gaps |
| **Dissent Log** | Counsel | Director, Reporter | Counter-arguments with cited evidence; Director's responses |

### 3.4 The confidence formula

```
evidence_support = weighted fraction of verdict claims backed by credible findings
critic_mean_credibility = mean credibility of findings used in the final verdict
unresolved_dissent_strength = max strength of unresolved Counsel objections

investigation_confidence = clamp(
  evidence_support * 0.60
  + critic_mean_credibility * 0.30
  - unresolved_dissent_strength * 0.40,
  0,
  1
)

If confidence > 0.7 → auto-resolve, high trust
If 0.4 < confidence ≤ 0.7 → flag for human spot-check
If confidence ≤ 0.4 → flag for full human review
```

The novel part is not that an LLM reports confidence. The novel part is that confidence is reduced by a separate adversarial agent and bounded by citation-backed evidence quality.

---

## 4. Tech stack

### 4.1 Locked picks (do not switch midway)

| Layer | Choice | Why |
|-------|--------|-----|
| Language | TypeScript (strict mode + `noUncheckedIndexedAccess`) | Single language, day-job alignment, type safety pays off in multi-agent systems |
| Runtime | Node 22 for deployed services; Bun allowed for local scripts/tests/package execution | Inngest, Next.js, Fastify, OTel, and hosting platforms are most predictable on Node; Bun is useful locally but should not be the production runtime assumption |
| API framework | Fastify | Native TS, schema validation, fast, sane plugin ecosystem |
| Database | Postgres 16 + Drizzle ORM | JSONB for artifacts, real ACID, type-safe queries |
| Hosted DB | Neon | Serverless Postgres with branching for dev/test environments; replay should use persisted events, not database branches per investigation |
| Durable workflows | Inngest | TS-native, durable, step checkpointing, replay |
| LLM provider | Anthropic SDK direct, addressed through model aliases | Primary stack without hard-coding model IDs throughout the app |
| LLM gateway | Small internal module, not a framework | Model aliases, retries, structured-output repair, cost tracking, timeout policy, and provider fallback hooks |
| Schema validation | Zod everywhere | Every LLM output, every API input, every config file |
| Logging | Pino | Structured JSON, low overhead, Loki-friendly |
| Observability | OpenTelemetry SDK → Tempo + Loki + Prometheus → Grafana | Self-hosted via Docker Compose in dev, Grafana Cloud in prod |
| Frontend | Next.js 15 (App Router) + React 19 + Tailwind + shadcn/ui | Streaming SSE native, well-known |
| Frontend state | TanStack Query + Zustand | Server cache + lightweight client state |
| Real-time updates | Server-Sent Events (not WebSockets) | One-way, simpler, proxy-friendly |
| Graph visualization | React Flow (xyflow) | Production-grade, used by LangGraph/n8n |
| Testing | Vitest + Playwright | Modern, TS-native, fast |
| Linting | Biome | One tool, zero config, fast |
| Monorepo | Turborepo (apps: `api`, `worker`, `dashboard`; packages: `shared-types`, etc.) | Standard, fast caching |
| Deployment | API+Worker on Railway, Dashboard on Vercel, observability on Grafana Cloud free tier | Hobby-friendly, under $15/month |

Runtime rule: the production target is Node 22. Bun can run local commands, but code must not depend on Bun-only APIs unless the file lives in a local-only script package.

LLM provider rule: application code calls model aliases (`director.primary`, `expert.cheap`, `critic.balanced`, `reporter.primary`) instead of hard-coding model names. The gateway maps aliases to current provider/model IDs in config.

### 4.2 Explicitly not using

- Python (TS ecosystem is mature enough now)
- MongoDB (need joins, transactions, JSONB indexing)
- BullMQ as primary workflow engine (use Inngest for durability; BullMQ only if needed for simple side-jobs)
- LangChain/LangGraph as the orchestration layer (too much hidden state for this project); small utility packages are fine if they solve a narrow problem
- Kubernetes/Helm (Docker Compose for dev, simple platforms for prod)
- WebSockets (SSE is enough)
- Microservices (API server + Worker, that's it)

---

## 5. System architecture (services)

### 5.1 Services

```
┌────────────────────────────────────────────────────────┐
│  Incident Sources (webhooks: Sentry, PagerDuty, etc.)  │
└─────────────────────┬──────────────────────────────────┘
                      │ POST /investigations
                      ▼
┌────────────────────────────────────────────────────────┐
│  API SERVER (Fastify)                                  │
│  - REST API                                            │
│  - SSE stream of investigation events                  │
│  - Auth + rate limiting                                │
└─────────────────────┬──────────────────────────────────┘
                      │ writes job
                      ▼
┌────────────────────────────────────────────────────────┐
│  Inngest Cloud (durable workflow orchestrator)         │
└─────────────────────┬──────────────────────────────────┘
                      │ invokes workflow step
                      ▼
┌────────────────────────────────────────────────────────┐
│  WORKER (Node 22 process)                              │
│  - Executes investigation workflow                     │
│  - Calls LLMs (Anthropic) via custom gateway           │
│  - Runs Expert tools (queries Tempo/Loki/etc.)         │
│  - Persists artifacts to Postgres                      │
│  - Emits OTel spans for everything                     │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│  Postgres (Neon)                                       │
│  - investigations, journal_entries, review_findings,   │
│    timeline_events, dissent_entries, tool_calls,       │
│    investigation_events                                │
└────────────────────────────────────────────────────────┘

DASHBOARD (Next.js on Vercel) — talks to API server via REST + SSE
OBSERVABILITY (Tempo + Loki + Prometheus + Grafana) — sidecar to everything
```

### 5.2 Runtime boundaries

- API server owns HTTP, auth, request validation, SSE, and read APIs.
- Worker owns all agent execution, tool execution, durable workflow state transitions, and artifact writes.
- Dashboard never talks directly to Postgres or Inngest. It only talks to the API server.
- Shared packages must be pure TypeScript libraries with no service-specific environment reads at import time.
- Every state-changing Worker operation must be idempotent by `(investigation_id, round_number, step_key)` because workflow steps can be retried.

### 5.3 Repo structure

```
argus/
├── apps/
│   ├── api/                  # Fastify API server
│   ├── worker/               # Inngest workflow handlers
│   └── dashboard/            # Next.js frontend
├── packages/
│   ├── shared-types/         # Zod schemas (used by all)
│   ├── llm-gateway/          # Custom multi-provider router
│   ├── agents/               # Director, Experts, Critic, Counsel, Reporter
│   ├── backends/             # Tempo, Loki, Prometheus, GitHub, Git adapters
│   ├── db/                   # Drizzle schema + queries
│   └── otel/                 # Shared OTel setup
├── eval/
│   ├── datasets/             # Labeled incidents
│   ├── runners/              # Evaluation scripts
│   └── results/              # Output reports
├── infra/
│   ├── docker-compose.yml    # Local dev stack
│   └── chaos/                # Chaos injection scripts
└── docs/
    ├── ARCHITECTURE.md
    ├── ENGINEERING_RULES.md
    ├── AGENT_PROTOCOL.md
    ├── DATA_MODEL.md
    ├── BUILD_ORDER.md
    └── EVALS.md
```

---

## 6. Database schema (the persistence layer)

```sql
CREATE TABLE investigations (
  id              UUID PRIMARY KEY,
  incident_id     TEXT NOT NULL,
  status          TEXT NOT NULL,  -- 'running' | 'completed' | 'failed' | 'cancelled'
  current_phase   TEXT NOT NULL,  -- 'triage' | 'trace' | 'verdict'
  current_round   INT NOT NULL DEFAULT 0,
  trigger_payload JSONB NOT NULL, -- the original webhook
  final_report    JSONB,          -- populated at Verdict
  confidence      NUMERIC(3,2),   -- populated at Verdict
  total_cost_usd  NUMERIC(10,4),  -- running total
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  CHECK (current_phase IN ('triage', 'trace', 'verdict', 'done')),
  CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE TABLE journal_entries (
  id               UUID PRIMARY KEY,
  investigation_id UUID NOT NULL REFERENCES investigations(id),
  round_number     INT NOT NULL,
  phase            TEXT NOT NULL,
  entry_type       TEXT NOT NULL,  -- 'decision' | 'observation' | 'finding' | 'question' | 'hypothesis' | 'action' | 'counter_evidence'
  content          TEXT NOT NULL,
  priority         TEXT,           -- 'low' | 'medium' | 'high' | 'critical'
  cited_tool_calls JSONB NOT NULL DEFAULT '[]',
  cited_findings   JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT now(),
  CHECK (entry_type IN ('decision', 'observation', 'finding', 'question', 'hypothesis', 'action', 'counter_evidence')),
  CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'critical'))
);

CREATE TABLE review_findings (
  id               UUID PRIMARY KEY,
  investigation_id UUID NOT NULL REFERENCES investigations(id),
  round_number     INT NOT NULL,
  expert_name      TEXT NOT NULL,
  finding_text     TEXT NOT NULL,
  credibility      NUMERIC(3,2) NOT NULL,  -- 0.00 to 1.00
  credibility_band TEXT NOT NULL,          -- 'trustworthy' | 'highly_plausible' | 'plausible' | 'speculative' | 'misguided'
  cited_tool_calls JSONB NOT NULL,
  critic_notes     TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  CHECK (credibility >= 0 AND credibility <= 1),
  CHECK (credibility_band IN ('trustworthy', 'highly_plausible', 'plausible', 'speculative', 'misguided'))
);

CREATE TABLE timeline_events (
  id               UUID PRIMARY KEY,
  investigation_id UUID NOT NULL REFERENCES investigations(id),
  round_number     INT NOT NULL,
  event_timestamp  TIMESTAMPTZ NOT NULL,
  event_text       TEXT NOT NULL,
  source_findings  JSONB NOT NULL
);

CREATE TABLE timeline_metadata (
  investigation_id UUID PRIMARY KEY REFERENCES investigations(id),
  confidence_score NUMERIC(3,2),
  evidence_gaps    JSONB
);

CREATE TABLE dissent_entries (
  id                UUID PRIMARY KEY,
  investigation_id  UUID NOT NULL REFERENCES investigations(id),
  round_number      INT NOT NULL,
  counter_argument  TEXT NOT NULL,
  dissent_strength  NUMERIC(3,2) NOT NULL,
  evidence_cited    JSONB NOT NULL,
  director_response TEXT,
  resolved          BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  CHECK (dissent_strength >= 0 AND dissent_strength <= 1)
);

CREATE TABLE tool_calls (
  id               UUID PRIMARY KEY,
  investigation_id UUID NOT NULL REFERENCES investigations(id),
  step_key         TEXT NOT NULL,
  expert_name      TEXT NOT NULL,
  tool_name        TEXT NOT NULL,
  arguments        JSONB NOT NULL,
  result           JSONB,
  error            TEXT,
  duration_ms      INT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (investigation_id, step_key)
);

CREATE TABLE agent_outputs (
  id               UUID PRIMARY KEY,
  investigation_id UUID NOT NULL REFERENCES investigations(id),
  round_number     INT NOT NULL,
  phase            TEXT NOT NULL,
  agent_role       TEXT NOT NULL,
  step_key         TEXT NOT NULL,
  model_alias      TEXT NOT NULL,
  model_id         TEXT NOT NULL,
  prompt_version   TEXT NOT NULL,
  input_snapshot   JSONB NOT NULL,
  output_json      JSONB NOT NULL,
  validation_error TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (investigation_id, step_key)
);

CREATE TABLE investigation_events (
  id               UUID PRIMARY KEY,
  investigation_id UUID NOT NULL REFERENCES investigations(id),
  sequence         BIGSERIAL,
  event_type       TEXT NOT NULL, -- 'phase_changed' | 'agent_started' | 'agent_completed' | 'tool_started' | 'tool_completed' | 'artifact_written' | 'error'
  payload          JSONB NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (investigation_id, sequence)
);

CREATE TABLE llm_calls (
  id               UUID PRIMARY KEY,
  investigation_id UUID NOT NULL REFERENCES investigations(id),
  agent_role       TEXT NOT NULL,
  model_alias      TEXT NOT NULL,
  model            TEXT NOT NULL,
  input_tokens     INT NOT NULL,
  output_tokens    INT NOT NULL,
  cost_usd         NUMERIC(10,6) NOT NULL,
  duration_ms      INT NOT NULL,
  trace_id         TEXT,           -- OTel correlation
  created_at       TIMESTAMPTZ DEFAULT now(),
  CHECK (input_tokens >= 0),
  CHECK (output_tokens >= 0),
  CHECK (cost_usd >= 0),
  CHECK (duration_ms >= 0)
);

CREATE INDEX idx_journal_investigation_round ON journal_entries(investigation_id, round_number);
CREATE INDEX idx_review_investigation_round ON review_findings(investigation_id, round_number);
CREATE INDEX idx_tool_calls_investigation ON tool_calls(investigation_id);
CREATE INDEX idx_agent_outputs_investigation_round ON agent_outputs(investigation_id, round_number);
CREATE INDEX idx_events_investigation_sequence ON investigation_events(investigation_id, sequence);
```

Schema rule: first-class artifacts get first-class tables. JSONB is for flexible payloads, cited evidence arrays, tool arguments/results, agent input snapshots, and final report documents. Do not store raw chat history as the primary workflow state, but do store compact input/output snapshots for audit and replay.

---

## 7. Agent design (prompts and tools)

### 7.1 Common patterns

- Every agent has a **system prompt** with role description, available context, and output schema requirements.
- Every agent outputs **strict JSON** validated by Zod before persistence.
- Every agent call is wrapped in an OTel span with attributes: `agent.role`, `agent.model`, `investigation.id`, `round.number`, `phase`, `tokens.in`, `tokens.out`, `cost.usd`.
- Validation failures trigger one retry with the validation error appended as a user message.
- Every prompt has a `prompt_version`. Store the version with each `agent_outputs` row.
- Agents receive compact artifact summaries plus cited evidence handles. They do not receive unlimited previous transcript history.
- Tool results are persisted before being summarized, so Critic and Counsel can inspect the exact source data instead of trusting an Expert summary.

### 7.2 Director

System prompt structure:
```
You are the Director of a security/incident investigation team.
Your job: decide what to investigate, who to ask, when to advance phases, when to conclude.
You do NOT investigate yourself; you orchestrate.

Available context:
- Journal: <your typed working memory>
- Review: <Critic's scored findings>
- Timeline: <consolidated chronology>
- Dissent Log: <Counsel's counter-arguments>

Available actions (you must output ONE per call):
- write_journal(entries[])
- dispatch_experts(experts[], questions[])
- advance_phase(from, to)
- declare_verdict(hypothesis, confidence)
```

Output schema: `DirectorAction` (discriminated union).

### 7.3 Experts (per Expert)

Each Expert has its own system prompt + a tool set. Example for Trace Expert:

```
You are the Trace Expert. You inspect distributed traces from the observability backend.

Available tools:
- get_trace(trace_id)
- search_traces(service, time_range, error_only)
- get_span(span_id)
- compute_critical_path(trace_id)
- find_slowest_spans(trace_id, k)

Your job: answer the Director's question by querying traces. Submit findings as JSON, citing the tool calls (by id) that support each finding.

Output: { findings: [{ text: string, cited_tool_calls: string[] }] }
```

Backends behind tools (interface-based, swappable):
```typescript
interface TraceSource {
  getTrace(id: string): Promise<Trace>
  search(query: SearchQuery): Promise<Trace[]>
  getSpan(id: string): Promise<Span>
}
class TempoBackend implements TraceSource { ... }
class JaegerBackend implements TraceSource { ... }
```

### 7.4 Critic

System prompt structure:
```
You are the Critic. Your only job: verify Expert findings against the cited evidence.

For each finding:
1. Read the claim.
2. Inspect the cited tool calls using your inspection tools (get_tool_call, get_tool_result).
3. Compare the claim against the actual data.
4. Assign a credibility score:
   0.9-1.0  Trustworthy      — multiple sources, no contradictions
   0.7-0.89 Highly-plausible — single corroborating source
   0.5-0.69 Plausible        — mixed evidence
   0.3-0.49 Speculative      — poor support
   0.0-0.29 Misguided        — no evidence or misinterpreted

You do NOT generate new findings. You ONLY score what's submitted.

After scoring all findings, construct a Timeline using only credibility >= 0.5 findings.
Identify the top 3 evidence gaps.
```

Tools: `get_tool_call`, `get_tool_result`, `get_expert_toolset`, `list_toolsets`.

### 7.5 Counsel (the novel agent)

System prompt structure:
```
You are the Counsel. Your job is to argue against the Director's hypothesis.

Even if you privately agree with the Director, you MUST find the strongest possible counter-arguments. This adversarial role is structural — the system depends on you arguing hard.

For each Director hypothesis:
1. Identify weakest assumptions.
2. Look for evidence that contradicts or merely fails to support the hypothesis.
3. Propose alternative explanations.
4. Rate dissent strength 0.0-1.0:
   1.0 = strong, well-supported counter-argument
   0.5 = plausible doubt
   0.0 = no real counter-argument (concede)

Use the same inspection tools as the Critic.
Output to the Dissent Log.
```

### 7.6 Reporter

Called once at Verdict. System prompt:
```
You are the Reporter. Generate the final incident report from the investigation artifacts.

Inputs:
- Journal (Director's reasoning trail)
- Review (Critic's scored findings)
- Timeline (chronological narrative)
- Dissent Log (Counsel's counter-arguments and Director's responses)

Output format (strict JSON):
{
  verdict: string,                  // 1-paragraph root cause statement
  confidence: number,               // computed from evidence support, Critic credibility, and unresolved dissent
  timeline: TimelineEvent[],
  evidence_chain: Citation[],       // every claim → tool call id
  dissent_considered: string,       // summary of what Counsel raised and how it was addressed
  recommended_fix: { immediate: string, long_term: string }
}
```

---

## 8. The investigation workflow (Inngest)

Pseudocode of the durable workflow:

```typescript
inngest.createFunction(
  { id: "investigation" },
  { event: "investigation.requested" },
  async ({ event, step }) => {
    const investigationId = await step.run("create-investigation", () =>
      db.createInvestigation(event.data)
    )

    let phase: Phase = "triage"
    let round = 0

    while (phase !== "done") {
      round++

      const cancelled = await step.run(`r${round}-check-cancelled`, () =>
        db.isInvestigationCancelled(investigationId)
      )
      if (cancelled) break

      // 1. Director plans
      const directorAction = await step.run(`r${round}-director`, () =>
        runDirector(investigationId, round, phase)
      )

      // 2. Branch on Director's action
      if (directorAction.type === "dispatch_experts") {
        await Promise.all(
          directorAction.experts.map(e =>
            step.run(`r${round}-expert-${e.name}`, () =>
              runExpert(e.name, e.questions, investigationId, round)
            )
          )
        )

        // 3. Critic always runs after Experts
        await step.run(`r${round}-critic`, () =>
          runCritic(investigationId, round)
        )
      }

      if (directorAction.type === "advance_phase") {
        phase = directorAction.to
      }

      // 4. Counsel runs in Trace and Verdict phases
      if (phase === "trace" || phase === "verdict") {
        await step.run(`r${round}-counsel`, () =>
          runCounsel(investigationId, round)
        )
      }

      if (directorAction.type === "declare_verdict") {
        const unresolvedDissent = await step.run(`r${round}-check-dissent`, () =>
          getStrongestUnresolvedDissent(investigationId)
        )

        if (unresolvedDissent?.strength > 0.6 && round < 20) {
          phase = "trace"
          continue
        }

        await step.run("reporter", () =>
          runReporter(investigationId)
        )
        phase = "done"
      }

      // Safety: max 20 rounds
      if (round >= 20) {
        await step.run("force-close", () =>
          forceCloseInvestigation(investigationId, "round_limit_exceeded")
        )
        break
      }
    }
  }
)
```

Every `step.run` is checkpointed by Inngest. If the worker crashes mid-investigation, it resumes at the last successful step. Step IDs must be deterministic. Writes inside a step must be idempotent because any step can be retried after a timeout, network failure, or process crash.

---

## 9. Backends (the integration layer)

| Data type | Interface | Implementations (v1) | Future |
|-----------|-----------|----------------------|--------|
| Traces | `TraceSource` | Tempo (HTTP API) | Jaeger, Honeycomb, Datadog |
| Logs | `LogBackend` | Loki (LogQL) | Elasticsearch, Splunk, Datadog |
| Metrics | `MetricBackend` | Prometheus (PromQL) | VictoriaMetrics, Datadog |
| Deploys | `DeployBackend` | GitHub Actions API | GitLab CI, CircleCI, Jenkins |
| Flags | `FlagBackend` | LaunchDarkly API | Statsig, Unleash |
| Code | `CodeBackend` | Local git clone + ripgrep | GitHub API for remote-only |

Config-driven backend selection:
```yaml
# config/dev.yaml
tracing:    { backend: tempo, endpoint: http://tempo:3200 }
logs:       { backend: loki,  endpoint: http://loki:3100 }
metrics:    { backend: prom,  endpoint: http://prometheus:9090 }
deploys:    { backend: github, token: ${GITHUB_TOKEN} }
flags:      { backend: launchdarkly, token: ${LD_TOKEN} }
code: {
  backend: git-local,
  clones: [
    { repo: "google/online-boutique", path: "/repos/online-boutique" }
  ]
}
```

Backend contract rules:
- Tool interfaces return normalized domain objects plus `raw_ref` or `raw_payload` for audit.
- Tool implementations never call LLMs.
- Tools must enforce timeouts and result-size limits before returning data to agents.
- Each tool call writes a `tool_calls` row before the agent summarizes it.
- Secrets come from environment variables or the deployment secret manager, not committed YAML.

---

## 10. API and event contract

### 10.1 Core REST API

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/investigations` | Validate incident input, create investigation, send Inngest event |
| `GET` | `/investigations` | List investigations with status/phase/confidence filters |
| `GET` | `/investigations/:id` | Read investigation summary and final report |
| `GET` | `/investigations/:id/artifacts` | Read Journal, Review, Timeline, Dissent Log |
| `GET` | `/investigations/:id/tool-calls/:toolCallId` | Read cited tool call input/result |
| `POST` | `/investigations/:id/cancel` | Mark investigation cancelled and stop future work |

### 10.2 SSE contract

Dashboard connects to:

```
GET /investigations/:id/events?after=<sequence>
```

The API server streams rows from `investigation_events` as SSE messages. On reconnect, the client sends the last seen `sequence` and the API server replays missed events before tailing new ones. The event table is the source of truth for Live View and read-only Replay View.

---

## 11. The Dashboard (frontend UX)

Three primary views:

### 11.1 Inbox
List of investigations. Filters by status, phase, confidence, time. Real-time updates via SSE.

### 11.2 Live View (the wow moment)
Streams an in-progress investigation:
- **Left column**: chronological event feed (Director writes Journal → Trace Expert dispatched → Trace Expert returned findings → Critic scoring → ...). Color-coded by agent.
- **Right column**: live state of Journal, Review, Timeline, Dissent Log as expandable panels.
- **Top bar**: current phase, elapsed time, running cost, cancel button.
- **Bottom**: token/cost meter, current model tier active.

### 11.3 Report View (final)
- Verdict at top, confidence prominently displayed.
- Timeline rendered visually.
- Evidence chain — every claim is a clickable link to the tool call + raw result.
- Dissent Considered section — Counsel's arguments and how they were resolved.
- Recommended Fix.
- "Replay" button → opens Replay View.

### 11.4 Replay View (bonus)
Scrub through investigation step by step, like a video, using persisted `investigation_events` and `agent_outputs`. v1 replay is read-only. Branching requires deterministic replay snapshots and is a v2 feature unless the schema and workflow are explicitly extended for it.

---

## 12. Observability (dogfooding our own domain)

Every Worker action is an OpenTelemetry span. Span hierarchy:

```
investigation (root span)
├── director.round_1
├── experts.round_1
│   ├── trace_expert
│   │   ├── llm_call
│   │   └── tool.get_trace
│   ├── log_expert
│   └── deploy_expert
├── critic.round_1
│   ├── llm_call
│   ├── tool.get_tool_call (multiple)
│   └── tool.get_tool_result (multiple)
├── director.round_2
├── ...
└── reporter
```

Span attributes everywhere:
- `investigation.id`
- `agent.role`
- `llm.model`
- `llm.tokens.in`, `llm.tokens.out`
- `llm.cost.usd`
- `phase`
- `round`

Custom Grafana dashboards:
- **Cost dashboard**: $ per investigation, broken down by agent role and model tier
- **Quality dashboard**: confidence score distribution, Counsel-catches-Director rate, root-cause accuracy (joined with eval results)
- **Latency dashboard**: time per investigation, per phase, per agent
- **Token dashboard**: tokens in/out per agent, prompt size growth across rounds

Because all of this is OTel, Argus can investigate its own traces. That's the dogfooding hook.

---

## 13. Evaluation strategy (the part that makes it real)

### 13.1 Eval data sources (in build order)

1. **Synthetic chaos**: Google Online Boutique microservices demo deployed locally via Docker Compose, with a chaos script that injects controlled failures (kill service, network latency, drop DB connection, bad deploy). Start with 5 incidents, then grow to 30. Ground truth is automatic because we caused the failure.
2. **Public post-mortems**: 20 hand-labeled incidents extracted from GitLab, Cloudflare, AWS, Stripe RCAs. Mock the telemetry based on what the post-mortem describes.
3. **Real Mastra failures**: 10 real failed Mastra agent runs with OTel traces, ground truth from manual diagnosis. Requires permission.
4. **Self-deployed app**: A tiny side app deployed with full OTel, running continuously, accumulating real incidents over time.

### 13.2 Metrics

- **Root-cause accuracy**: % of investigations where the verdict matches the known cause
- **Evidence quality**: % of cited spans/logs/lines that are directly relevant to the root cause
- **Counsel-catches-Director rate**: % of investigations where Counsel raises a valid concern the Director would otherwise miss
- **Confidence calibration**: do high-confidence investigations actually correlate with correct verdicts?
- **Cost per investigation**: $ avg, p50, p95
- **Latency per investigation**: seconds avg, p50, p95
- **Baseline comparison**: same incidents fed to a single strongest-model call with all tools. Show Argus beats baseline on accuracy and/or on cost-adjusted accuracy.

### 13.3 Eval harness

- Vitest-based runner: each incident is a test case
- Output: JSON report per run, summary table comparing runs
- CI: on every PR to `main`, run a smoke subset (5 incidents); on merge to `main`, run the full 60

---

## 14. Build sequence (order of implementation)

| Phase | Deliverable | Definition of done |
|-------|-------------|---------------------|
| **0** | Monorepo + schemas | TypeScript strict mode; shared Zod schemas; Drizzle schema; config loader; model alias config; basic test setup. |
| **1** | API + persistence | Fastify API server serving `POST /investigations`, `GET /investigations/:id`, artifact reads, and SSE from `investigation_events`; Postgres migrations applied. |
| **2** | Durable workflow skeleton | Inngest workflow creates an investigation, emits events, advances phases, enforces max rounds, and writes idempotently by deterministic `step_key`. |
| **3** | Mocked agent loop | Director dispatches one mocked Expert; Expert returns citation-backed findings; Critic scores them; Reporter writes a structured report. This proves the core loop before real backends. |
| **4** | Real observability backends | Trace Expert on Tempo, Log Expert on Loki, Metric Expert on Prometheus, Deploy Expert on mock JSON/GitHub Actions, Code Expert on local git. Tool calls are persisted before summaries. |
| **5** | Full phase machine | Triage -> Trace -> Verdict transitions; multi-round Director loop; evidence gaps; Timeline generation; failed/cancelled states. |
| **6** | Counsel + confidence | Counsel writes Dissent Log; Director responds to dissent; unresolved high-strength dissent can force another Trace round; final confidence uses evidence support + Critic credibility - unresolved dissent. |
| **7** | Dashboard | Inbox, Live View from SSE, Report View with clickable evidence, read-only Replay View from events. |
| **8** | Evaluation + deployment | Eval harness with smoke subset and full dataset; baseline comparison; cost/latency/accuracy reporting; deployed demo or reproducible local demo. |

Each phase should end with a working vertical slice committed. Deployment to staging is useful once Phase 2 is stable.

---

## 15. Definition of "done" for v1

- [ ] At least 60 incidents in the eval set across 3 categories.
- [ ] Root-cause accuracy >= 65% on the eval set.
- [ ] Counsel-catches-Director rate >= 15% (proves the adversarial unit is doing real work).
- [ ] Confidence score is calibrated (high-conf investigations have measurably higher accuracy).
- [ ] Cost per investigation < $1 average.
- [ ] Full investigation completes in < 90s p95.
- [ ] Live View streams updates with <500ms lag.
- [ ] Every claim in every report is clickable to the underlying evidence.
- [ ] System runs against the canonical OSS observability stack (Tempo + Loki + Prom + GitHub) out of the box.
- [ ] Argus can investigate its own traces (dogfood demo).
- [ ] Public hosted demo at a URL.
- [ ] README with architecture, eval methodology, results table, baseline comparison.

---

## 16. Risks and how we handle them

| Risk | Mitigation |
|------|------------|
| LLM costs spiral during dev | Cost meter from day 1; daily budget alerts; default to cheapest acceptable model aliases while debugging |
| Inngest is the wrong abstraction | Keep workflow orchestration behind a small `WorkflowRuntime` boundary; keep durable state in Postgres; avoid leaking Inngest concepts into agent packages |
| Evals are flaky (LLM randomness) | Each eval case runs N=3 times; report mean and stdev; only count as regression if outside 1-stdev band |
| Counsel produces noise (argues for the sake of arguing) | Counsel dissent must cite evidence or missing evidence; Critic can score dissent quality; low-quality dissents are excluded from the confidence formula |
| Domain knowledge gap (LLM doesn't know company services) | Knowledge base layer: YAML files for service graph, known noise patterns, ownership; injected into every Expert prompt |
| Project drifts into infinite polishing | Phase gates; each phase must produce a working vertical slice before adding optional UX or extra backends |
| Chaos kit produces unrealistic incidents | Add 20 real post-mortems as the realism floor; if chaos-kit performance >> post-mortem performance, the chaos kit is too easy |
| Burnout from a long solo build | Keep optional work explicitly marked as v2/stretch; pause frontend polish until the investigation loop is useful |

---

## 17. What's explicitly NOT in v1

- Auth (single shared API key on API server)
- Multi-tenancy
- Web UI for editing prompts (edit in code; redeploy)
- Slack/Discord notification integrations (just the webhook in)
- Mobile app
- Fine-tuned models (off-the-shelf only)
- More than 5 Expert types
- Investigation branching/forking from replay
- Real-time collaboration on investigations

These go in v2.

---

## 18. Stretch goals (post-v1)

- **Counsel quality calibration**: train a small classifier on which Counsel dissents historically caught real issues; use it to weight dissent strength
- **Investigation merging**: when two investigations have correlated symptoms, propose merging them into a multi-incident investigation
- **"What-if" UI**: in the Replay View, let users edit a Director Journal entry and see how the rest of the investigation re-runs
- **Investigation diff**: given two investigations of similar incidents, highlight differences in trajectory
- **OTel auto-instrumentation library**: ship a `@argus/instrument` npm package that customers `import` and get Argus-compatible tracing in their app for free

---

## 19. Decisions log (the boring but crucial section)

Append-only log of architectural decisions. Each entry: date, decision, alternatives considered, reasoning.

**2026-05-23**: Inngest over Temporal. Temporal is best-in-class but TS SDK is less polished and ops overhead is real for solo dev. Inngest covers durability + replay + checkpointing well enough.

**2026-05-23**: First-class Postgres tables for first-class artifacts; JSONB for flexible payloads. Journal, Review, Timeline, Dissent, tool calls, agent outputs, and event stream need queryability, citations, idempotency, and replay support. JSONB is still used for tool results, evidence arrays, snapshots, and final report documents.

**2026-05-23**: Direct Anthropic SDK + small internal gateway over OpenRouter/LiteLLM. We learn more; we get exactly the model aliasing, cost, retry, timeout, structured-output repair, and fallback semantics we want; we don't depend on a third party for hot-path infrastructure.

**2026-05-23**: SSE over WebSockets for Live View. One-way is all we need; SSE is simpler and proxy-friendlier; we save 200 lines of frontend reconnection logic.

**2026-05-23**: Single-language TypeScript everywhere over polyglot stack. Faster iteration; same skill set across services; type sharing between API server, Worker, Dashboard via shared-types package.

**2026-05-23**: Node 22 as production runtime; Bun only for local developer ergonomics. The deployed path must stay compatible with the most predictable ecosystem for Fastify, Inngest, Next.js, OTel, and hosting providers.

**2026-05-23**: Read-only replay in v1; branching replay in v2. Branching requires deterministic snapshots, prompt/model versioning, and workflow restart semantics. The v1 event stream gives useful replay without pretending deterministic branching is already solved.

(Add a new entry every time we make a non-obvious choice.)

---

## 20. Open questions to resolve as we build

- How does Counsel get instantiated with different system prompts based on the Director's hypothesis type? (Probably: classify the hypothesis into a category, pick a specialized Counsel prompt from a registry.)
- Should the Critic and Counsel share inspection tools, or have separate but identical tool definitions? (Probably: shared tool definitions, separate agents.)
- Should the unresolved dissent threshold be fixed at 0.6 or learned/calibrated from eval data?
- How do we handle the case where an Expert returns NO findings? (Probably: Critic records this; Director's next action prompt is informed.)
- Multi-tenant secrets management at v2 time?

Answer these as the questions come up in implementation; don't pre-solve.

---

## 21. The honest take

This plan is architecturally ambitious. The hardest parts are Counsel design (the most novel piece, no reference implementation), Dashboard polish (frontend always takes longer than expected), and evals (they usually reveal that the system is worse than you thought it was).

If something has to be cut, the cut order is:
1. Replay View branching (already v2; keep read-only replay)
2. Code Expert (Trace + Log + Metric + Deploy alone can handle most incidents)
3. The Mastra-failures dataset (synthetic + post-mortems is enough for a real eval)
4. The deployed demo (a README with screenshots + a video is acceptable if the demo is brittle)

Do not cut:
- Counsel (the entire novel contribution)
- Critic with inspection tools (the Slack-proven core)
- The eval harness (the project is unserious without it)
- The OTel-everywhere instrumentation (the dogfood story)

Build it.
