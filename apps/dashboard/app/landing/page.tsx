import Link from "next/link"

const incidentRows = [
  {
    id: "INC-3175",
    name: "Webhook retries spiking on /v1/orders",
    meta: "SEV-3 - payments-api",
    state: "investigating",
  },
  {
    id: "INC-3174",
    name: "Checkout p95 latency 2.4x baseline",
    meta: "SEV-2 - checkout",
    state: "dissent open",
  },
  {
    id: "INC-3173",
    name: "Stripe webhook signature mismatches",
    meta: "SEV-3 - billing",
    state: "low conf.",
  },
  {
    id: "INC-3172",
    name: "Auth token refresh 5xx burst",
    meta: "SEV-3 - identity",
    state: "cited",
  },
]

const usualRoomItems = [
  "First plausible cause becomes the cause. Dissent dies in the thread.",
  '"AI summary" repeats what the loudest engineer typed five minutes ago.',
  "Logs, traces, and deploy diffs sit in five tools nobody opens during the call.",
  "Postmortem writes itself from the chat scrollback, citations optional.",
  'Missing tools become "we could not check," then quietly become "fine."',
]

const argusItems = [
  "Every claim links to a source. No claim, no citation, no verdict.",
  "Confidence reflects evidence quality, not how confident an LLM sounds.",
  "A separate Counsel agent files dissent and can block a verdict from closing.",
  "Unresolved dissent reduces confidence; the report says so on the front page.",
  'Setup gaps are explicit. "Slow query log not connected" is not the same as "cleared."',
]

const workflowSteps = [
  {
    number: "01",
    title: "Incident arrives",
    badge: "intake",
    text: "From PagerDuty, Datadog, Opsgenie, scripts, or a raw webhook. Argus normalizes the alert into an incident record with source, severity, and time window.",
    tags: ["pagerduty", "webhook", "cli", "datadog", "opsgenie"],
  },
  {
    number: "02",
    title: "Investigators gather evidence",
    badge: "investigator xN",
    text: "Parallel agents pull deploy history, recent diffs, related metrics, log windows, trace samples, and on-call notes. Every fetched artifact is stored as cited evidence, not only paraphrased.",
    tags: ["github", "deploy.log", "metrics", "logs", "traces"],
  },
  {
    number: "03",
    title: "Critic verifies every claim",
    badge: "critic",
    text: "Each candidate claim must point to a citation; the Critic re-fetches the source and checks that the claim still survives. Claims that do not verify are demoted and shown as such.",
    tags: ["re-fetch", "hash match", "span check"],
  },
  {
    number: "04",
    title: "Counsel records dissent",
    badge: "counsel",
    text: "An adversarial agent argues for alternative causes the verdict would explain away. Dissents stay visible on the report and reduce confidence until follow-up evidence or a new investigation resolves them.",
    tags: ["alt-hypothesis", "counterfactuals", "coverage gaps"],
  },
  {
    number: "05",
    title: "Reporter writes the cited report",
    badge: "reporter",
    text: "The Reporter renders the verdict, timeline, evidence chain, setup gaps, and recommended next action into a shareable review document.",
    tags: ["verdict", "timeline", "review"],
  },
]

const workflowEvents = [
  ["01", "incident.received", "pagerduty - INC-3174 - SEV-2", "+0s"],
  ["02", "investigator.fanout", "4 agents - github, dd, loki, tempo", "+11s"],
  ["03", "critic.verify", "17 claims - 1 demoted to partial", "+41s"],
  ["04", "counsel.dissent", "2 unresolved - awaiting human", "+1m12s"],
  ["05", "reporter.draft", "confidence 0.48 - 23 citations", "+1m38s"],
]

export default function LandingPage() {
  return (
    <main className="tc-public-shell">
      <nav className="tc-public-nav" aria-label="Main navigation">
        <Link className="tc-public-brand" href="/landing">
          <span>T</span>
          <strong>Argus</strong>
        </Link>
        <div className="tc-public-nav-links">
          <a href="#product">Product</a>
          <a href="#workflow">How it works</a>
          <a href="#evidence">Evidence</a>
          <a href="#security">Security</a>
          <a href="#docs">Docs</a>
        </div>
        <div className="tc-public-nav-actions">
          <Link href="/login">Sign in</Link>
          <Link className="tc-public-button tc-public-button-dark" href="/signup">
            Start investigation <span aria-hidden="true">-&gt;</span>
          </Link>
        </div>
      </nav>

      <section className="tc-public-hero" id="product">
        <div className="tc-public-hero-copy">
          <p className="tc-public-status">
            <span aria-hidden="true" />
            v1 - multi-agent investigation runtime - read-only replay enabled
          </p>
          <h1>
            Incident reasoning with <mark>evidence</mark> and <mark>dissent</mark>.
          </h1>
          <p>
            Argus turns alerts, deploy context, logs, traces, metrics, and code clues into
            citation-backed incident reports. Every verdict shows its evidence, confidence, and
            unresolved dissent, so the room never has to take an agent's word for it.
          </p>
          <div className="tc-public-actions">
            <Link className="tc-public-button tc-public-button-dark" href="/signup">
              Create workspace <span aria-hidden="true">-&gt;</span>
            </Link>
            <a className="tc-public-button tc-public-button-light" href="#demo-report">
              View demo report
            </a>
            <span className="tc-public-shortcut">
              <kbd>G</kbd> <kbd>D</kbd> to open demo
            </span>
          </div>
          <div className="tc-public-proof-row" aria-label="Product proof points">
            <span>SOC 2 Type II in progress</span>
            <span>Read-only replay for incident review</span>
            <span>Self-host available</span>
          </div>
        </div>

        <ProductPreview />
      </section>

      <section className="tc-public-section tc-public-why">
        <div className="tc-public-section-heading">
          <p className="tc-public-kicker">01 - why teams need it</p>
          <h2>Most rooms commit to the first plausible story.</h2>
        </div>
        <p className="tc-public-section-copy">
          Under pressure, incident response collapses onto whatever cause is loudest. The first
          hypothesis becomes the answer, the contradicting log gets explained away, and the
          postmortem ratifies a guess. Argus keeps proof and dissent visible, even when the room
          wants to move on.
        </p>
        <div className="tc-public-compare">
          <ComparisonCard title="The usual incident channel" label="today" items={usualRoomItems} />
          <ComparisonCard title="With Argus" label="verdict workflow" items={argusItems} positive />
        </div>
      </section>

      <section className="tc-public-section tc-public-workflow" id="workflow">
        <div className="tc-public-section-heading">
          <p className="tc-public-kicker">02 - fixed workflow</p>
          <h2>Five agents, one record of how the verdict was reached.</h2>
        </div>
        <p className="tc-public-section-copy">
          Each incident moves through a fixed multi-agent workflow. Every step writes to the same
          evidence ledger, so the final report is reproducible and can be replayed claim by claim
          during review.
        </p>
        <div className="tc-public-workflow-grid">
          <div className="tc-public-step-list">
            {workflowSteps.map((step) => (
              <article className="tc-public-step" key={step.number}>
                <span>{step.number}</span>
                <div>
                  <h3>
                    {step.title} <small>{step.badge}</small>
                  </h3>
                  <p>{step.text}</p>
                  <div>
                    {step.tags.map((tag) => (
                      <code key={tag}>{tag}</code>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="tc-public-event-chain" aria-label="Workflow event chain">
            {workflowEvents.map(([number, name, meta, time], index) => (
              <div className="tc-public-event-item" key={name}>
                <div>
                  <span>{number}</span>
                  <strong>{name}</strong>
                  <small>{meta}</small>
                </div>
                <em>{time}</em>
                {index < workflowEvents.length - 1 ? <i /> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="tc-public-section tc-public-report" id="evidence">
        <div className="tc-public-section-heading">
          <p className="tc-public-kicker">03 - built for incident review</p>
          <h2>A report you can defend in the review meeting.</h2>
        </div>
        <p className="tc-public-section-copy">
          Every Argus verdict is a single, replayable document. Open it during review and walk
          through claim by claim: the same evidence chain the agents saw, with citations linked to
          captured tool results and configured sources.
        </p>
        <div className="tc-public-report-grid" id="demo-report">
          <article className="tc-public-report-card">
            <header>
              <span>T</span>
              <div>
                <strong>INC-3174 - Checkout p95 latency 2.4x baseline</strong>
                <small>verdict draft - signed by court-agent v1 - 14:08 UTC</small>
              </div>
              <em>read-only replay</em>
            </header>
            <section>
              <h3>Most likely cause</h3>
              <p>
                Deploy 9a32f1 introduced an N+1 query in CartLoader#load_addons, raising
                checkout.api.p95 from 280ms to 670ms in eu-west-1.
              </p>
              <div className="tc-public-citations">
                <code>github:pr/4821</code>
                <code>datadog:p95</code>
                <code>tempo:span/m3f1</code>
                <code>loki:idx/ckt</code>
              </div>
            </section>
            <section>
              <h3>Evidence confidence</h3>
              <p>
                <strong>0.48 - low.</strong> Two dissents unresolved, trace coverage sampled at 6%,
                and slow query log unavailable.
              </p>
            </section>
            <section>
              <h3>Timeline</h3>
              <ol>
                <li>14:01:33 deploy/9a32f1 rolled to eu-west-1</li>
                <li>14:02:11 checkout.api.p95 crosses 600ms threshold</li>
                <li>14:04:02 PagerDuty incident raised, on-call paged</li>
                <li>14:08:40 Argus draft verdict published</li>
              </ol>
            </section>
          </article>
          <div className="tc-public-report-side">
            <article>
              <h3>Verdict confidence</h3>
              <strong>
                0.48 <small>low</small>
              </strong>
              <div className="tc-public-meter">
                <span />
              </div>
              <p>Unresolved dissent reduces confidence. Projected 0.78 once gaps close.</p>
            </article>
            <article>
              <h3>Replay</h3>
              <p>
                Re-fetches every cited artifact read-only at view time. Reviewers see what the
                agents saw, not an edited story.
              </p>
              <div className="tc-public-actions tc-public-actions-tight">
                <a className="tc-public-button tc-public-button-light" href="#demo-report">
                  Open replay
                </a>
                <a className="tc-public-button tc-public-button-light" href="#demo-report">
                  Export postmortem
                </a>
              </div>
            </article>
            <article id="security">
              <h3>Signatures</h3>
              <p>
                court-agent - v1 - 14:08 UTC
                <br />
                chain hash - sha256:7c1f...a2d
                <br />
                workspace - acme-platform
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="tc-public-final" id="docs">
        <div>
          <p className="tc-public-kicker">04 - start with one incident</p>
          <h2>Start with one incident. See what survives the critic.</h2>
          <p>
            Connect GitHub, point an alerting webhook at Argus, and forward a single past incident.
            You get a cited verdict with dissent inside minutes, with no shaping the data and no
            agent personality to argue with.
          </p>
          <div className="tc-public-actions">
            <Link className="tc-public-button tc-public-button-light-on-dark" href="/signup">
              Create workspace <span aria-hidden="true">-&gt;</span>
            </Link>
            <Link className="tc-public-button tc-public-button-outline-dark" href="/signup">
              Connect GitHub
            </Link>
            <a className="tc-public-button tc-public-button-outline-dark" href="#docs">
              Read the API docs
            </a>
          </div>
        </div>
        <pre aria-label="Argus incident API example">{`POST /v1/incidents

curl https://api.argus.io/v1/incidents \\
  -H "Authorization: Bearer $TC_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "pagerduty",
    "service": "checkout",
    "severity": "sev-2",
    "signal": "checkout.api.p95 > 600ms",
    "started_at": "2026-05-21T14:02:11Z"
  }'

201 Created - investigation INC-3174 - agents fanning out...`}</pre>
      </section>

      <footer className="tc-public-footer">
        <div>
          <Link className="tc-public-brand" href="/landing">
            <span>T</span>
            <strong>Argus</strong>
          </Link>
          <p>
            Incident reasoning with evidence and dissent. Built for senior engineers, SREs, and
            incident commanders who do not trust a verdict without sources.
          </p>
        </div>
        <nav aria-label="Product links">
          <strong>Product</strong>
          <a href="#product">Investigations</a>
          <a href="#evidence">Evidence chain</a>
          <a href="#workflow">Counsel and dissent</a>
          <a href="#demo-report">Replay</a>
        </nav>
        <nav aria-label="Integration links">
          <strong>Integrations</strong>
          <a href="#docs">GitHub</a>
          <a href="#docs">PagerDuty</a>
          <a href="#docs">Datadog and Grafana</a>
          <a href="#docs">Loki and OpenSearch</a>
          <a href="#docs">Tempo and Honeycomb</a>
        </nav>
        <nav aria-label="Company links">
          <strong>Company</strong>
          <a href="#security">Security</a>
          <a href="#docs">Changelog</a>
          <a href="#docs">Docs</a>
          <a href="#docs">Status</a>
        </nav>
      </footer>
    </main>
  )
}

function ProductPreview() {
  return (
    <div className="tc-public-preview" aria-label="Argus product preview">
      <div className="tc-public-preview-top">
        <span />
        <span />
        <span />
        <strong>app.argus.io / acme-platform / investigation / INC-3174</strong>
        <kbd>Cmd K</kbd>
      </div>
      <div className="tc-public-preview-grid">
        <aside>
          <h3>Workspace</h3>
          <a className="active" href="#product">
            Investigations <span>12</span>
          </a>
          <a href="#product">
            Active <span>3</span>
          </a>
          <a href="#product">
            Reports <span>48</span>
          </a>
          <h3>Evidence sources</h3>
          <p>
            GitHub <span>ok</span>
          </p>
          <p>
            Datadog <span>ok</span>
          </p>
          <p>
            Loki <span>ok</span>
          </p>
          <p>
            Tempo <span className="warn">gap</span>
          </p>
        </aside>
        <section className="tc-public-preview-list">
          <div className="tc-public-preview-filters">
            <button type="button">Active</button>
            <button type="button">Closed</button>
            <button type="button">All</button>
            <span>filter: severity &gt;= SEV-2 - last 24h</span>
          </div>
          {incidentRows.map((row) => (
            <article className={row.id === "INC-3174" ? "selected" : ""} key={row.id}>
              <span>{row.id}</span>
              <div>
                <strong>{row.name}</strong>
                <small>{row.meta}</small>
              </div>
              <em>{row.state}</em>
            </article>
          ))}
        </section>
        <aside className="tc-public-preview-evidence">
          <header>
            <strong>Evidence</strong>
            <span>E3</span>
          </header>
          <article>
            <small>github - pr/4821 - merged</small>
            <span>verified</span>
            <pre>{`- app/loaders/cart-loader.rb def
load_addons(cart)
cart.items.preload(:addons)
flat_map(&:addons) + addons =`}</pre>
          </article>
          <article>
            <small>datadog - checkout.api.p95</small>
            <span>2.4x baseline</span>
            <div className="tc-public-sparkline" />
          </article>
          <article>
            <small>counsel.dissent</small>
            <p>Slow query logs are unavailable. Marking verdict low confidence until connected.</p>
          </article>
        </aside>
      </div>
    </div>
  )
}

function ComparisonCard({
  items,
  label,
  positive = false,
  title,
}: {
  items: string[]
  label: string
  positive?: boolean
  title: string
}) {
  return (
    <article className="tc-public-compare-card">
      <h3>
        {title} <small>{label}</small>
      </h3>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <span>{positive ? "+" : "x"}</span>
            {item}
          </li>
        ))}
      </ul>
    </article>
  )
}
