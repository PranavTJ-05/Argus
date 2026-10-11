# First Customer Pitch

This document explains Argus in customer language. Use it before a first design-partner or beta customer conversation.

## One-Line Pitch

Argus turns production incidents into citation-backed investigation reports with evidence, dissent, confidence, and recommended next actions.

## Simple Pitch

When something breaks in production, teams waste time asking what changed, which service is responsible, whether the alert is real, and what evidence supports the answer.

Argus investigates the incident like a structured incident commander. It gathers evidence, challenges the likely cause, records dissent, and produces a report the team can audit.

## What Argus Is Not

- It is not just chat with logs.
- It is not a generic dashboard.
- It is not a replacement for observability tools.
- It does not claim certainty without evidence.

Argus sits on top of observability and deploy data, then reasons over it.

## Customer Workflow

1. A monitoring tool, on-call engineer, or automation creates an incident.
2. The customer sends the incident to Argus with `POST /investigations`.
3. Argus creates an investigation and starts the Inngest workflow.
4. Director decides what evidence to inspect.
5. Experts gather evidence from configured tools.
6. Critic checks whether findings are supported by cited evidence.
7. Counsel argues against the likely cause and records dissent.
8. Reporter writes the final incident report.
9. The customer opens the dashboard to review the report, evidence, dissent, and recommendation.

## Dashboard Sections

### Investigations

The left sidebar is the incident inbox. It shows running, completed, and failed investigations.

Use it to answer:

- Which incidents are currently being investigated?
- Which incidents are complete?
- Which investigations need setup attention?

### Incident Header

The header summarizes the selected investigation.

Use it to answer:

- What incident am I looking at?
- Is the investigation running or complete?
- What confidence did Argus assign?
- When was it updated?

### Live View

Live View shows investigation progress from `investigation_events`.

Use it to answer:

- What has Argus done so far?
- Which phase is the workflow in?
- Did the workflow fail, skip an integration, or complete?

### Report

Report is the primary customer value.

It should answer:

- What is the most likely cause?
- What evidence supports it?
- What dissent or uncertainty remains?
- What should the team do next?

### Evidence

Evidence shows the citation chain behind the report.

A citation means a claim points to a specific tool result, evidence row, or evidence gap. This is how the customer verifies that the AI did not make up the answer.

### Replay

Replay is a read-only view of how the investigation unfolded.

It is useful after the incident, during postmortem review, or when a teammate joins late.

### Evidence Inspector

The right panel shows the selected evidence details.

Use it to inspect:

- tool input,
- tool result,
- error,
- duration,
- whether the report cited the evidence.

## What The Customer Provides In v1

Minimum:

- A Argus API key.
- Incident payloads through API, script, or webhook.

Useful incident payload fields:

- incident ID,
- service,
- environment,
- severity,
- summary,
- start time,
- end time.

Optional for better evidence:

- deploy ref,
- commit SHA,
- log query,
- metric query,
- code pattern,
- feature flag context.

Operator/internal credentials:

- Anthropic API key.
- Inngest keys.
- Postgres URL.
- Render or hosting secrets.

These are not normally given by the customer unless the deployment is inside the customer's own environment.

## First Demo Script

For the operational demo checklist, use `docs/DEMO_PLAYBOOK.md`.

1. Start with the pain:
   "During incidents, teams lose time because evidence is spread across alerts, logs, deploys, traces, and chat."

2. Show incident creation:
   "A monitoring alert or engineer sends one investigation request to Argus."

3. Show the inbox:
   "The incident appears here and moves through running to completed."

4. Show the report:
   "This is the final answer: likely cause, confidence, dissent, and next action."

5. Show evidence:
   "Every important claim links back to evidence, so the team can audit the reasoning."

6. Show dissent:
   "Argus does not only confirm its first guess. Counsel challenges the hypothesis, and confidence is reduced when uncertainty remains."

7. Close with setup:
   "For your beta, we start with one integration path and one service. The goal is not every incident; the goal is proving Argus can produce useful cited reports on your real incidents."

## Honest v1 Limitations

- v1 is best for private beta or single-tenant use.
- Dashboard auth and workspace-scoped data access exist, but public SaaS features such as team
  invites, SSO, automated billing, and production-grade tenant administration are not complete yet.
- Evidence quality depends on configured integrations.
- Missing integrations are shown as evidence gaps.
- Some early investigations may have low confidence until real customer data sources are connected.

## First Customer Ask

Ask the customer for:

- one service they care about,
- one recent or recurring incident type,
- their preferred evidence source,
- whether they can provide API-triggered incident payloads,
- whether the beta should run in your environment or theirs.

Recommended first integration:

1. GitHub code/deploy if they want deploy correlation.
2. Prometheus if they want metric-backed latency/error reports.
3. Loki if they want log-backed reports.
4. Tempo if they want trace-backed reports.
