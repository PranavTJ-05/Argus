# Demo and Pitch

## Positioning

> Argus turns production incidents into citation-backed investigation reports. It gathers evidence, challenges the first hypothesis, records dissent, and ties confidence to evidence quality.

What it is not: chat over logs, a generic dashboard, a replacement for observability tools, or something that claims certainty without evidence. It sits on top of observability and deploy data and reasons over it.

The beta goal is modest: prove Argus produces useful, auditable reports for one real recurring incident pattern.

## Dashboard tour

| Area | Answers |
| --- | --- |
| Inbox | What is running, done or failed? |
| Header | Which incident, what status, what confidence, when updated? |
| Live View | What has Argus done so far? |
| Report | Likely cause, supporting evidence, remaining doubt, next steps |
| Evidence | The citation chain behind each claim |
| Replay | A read-only walk through how the investigation unfolded |
| Inspector | Tool input, result, error, duration, and whether the report cited it |

## Preparing the demo

Set `API_BASE_URL`, `DASHBOARD_URL` and `API_KEY` (plus GitHub credentials for the strongest demo), then run:

```bash
pnpm demo:v1
```

This creates an investigation with an ID beginning `demo-checkout-latency-`, separate from `smoke-*` test runs. The story: *checkout p95 latency rose after a payment authorization deploy*, with service `checkout`, environment `prod`, code pattern `payment_authorize`, deploy ref `2026.05.24`.

## 5 to 10 minute walkthrough

1. **Pain:** evidence is scattered across alerts, logs, metrics, deploys, traces and chat.
2. **Create or open** the demo investigation and show the inbox moving from running to completed.
3. **Report:** likely cause, recommendation, confidence explanation, remaining uncertainty.
4. **Citations:** click an evidence row; the proof behind a claim is one click away.
5. **Dissent:** Counsel challenges the first guess, and confidence falls when doubt remains.
6. **Setup gaps:** missing integrations are recorded honestly, never fabricated.
7. **Close with scope:** one service, one evidence source, judged on real recurring incidents.

If confidence is low, say so plainly: Argus lowers confidence when evidence is missing or objections stand, and that is the feature. Then name the integration that would raise it (GitHub, Prometheus, Loki, Tempo).

## What the customer provides

- Minimum: an API key and incident payloads via API, script or webhook.
- Useful payload fields: incident ID, service, environment, severity, summary, start and end time; optionally deploy ref, commit SHA, queries, code pattern, flag context.
- Operator-held (not the customer's unless self-hosted): Anthropic key, Inngest keys, Postgres URL, hosting secrets.

## First customer ask

1. One service they care about.
2. One recent or recurring incident type.
3. One evidence source they can connect first.
4. One engineer who can send a payload or webhook.
5. Agreement that early reports are beta output, not authoritative postmortems.

## Follow-up email

> **Subject:** Argus beta follow-up
>
> Thanks for reviewing Argus. It turns incidents into citation-backed reports: a clear likely cause, evidence behind each claim, dissent when the hypothesis is shaky, and confidence that drops when evidence is missing. To start, please share one service, one recurring incident pattern, which of GitHub, Prometheus, Loki or Tempo is easiest to connect, and who should receive the dashboard URL and API key.
