# v1 Demo Playbook

Use this playbook for a first customer or internal company demo. The goal is to show Argus as
an incident investigation product, not as a generic dashboard.

## Demo Goal

Show that Argus can accept an incident, run an investigation, produce a report, cite evidence,
record dissent, and explain confidence.

## Before The Demo

Required environment:

```text
API_BASE_URL=
DASHBOARD_URL=
API_KEY=
```

Recommended for the strongest first demo:

```text
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
```

Run the demo investigation:

```bash
pnpm demo:v1
```

The script creates an incident ID beginning with `demo-checkout-latency-`. This keeps demo records
separate from noisy `smoke-*` deployment tests.

## Demo Incident

Use this story:

```text
Checkout p95 latency increased after a payment authorization deploy.
```

The demo payload includes:

- service: `checkout`
- environment: `prod`
- severity: `high`
- code pattern: `payment_authorize`
- deploy ref: `2026.05.24`
- branch: `main`
- metric/log/code hints

## 5-10 Minute Walkthrough

1. **Open with the pain.**
   "When production breaks, evidence is scattered across alerts, logs, metrics, deploys, traces,
   and chat. Teams lose time proving what actually happened."

2. **Create or show the demo investigation.**
   Open the dashboard and select the `demo-checkout-latency-*` investigation.

3. **Show the inbox.**
   Explain that the left side is the incident queue. It separates running, completed, and failed
   investigations.

4. **Show the Customer Summary.**
   Explain that this is the primary output:
   - most likely cause,
   - recommended next action,
   - confidence explanation,
   - dissent or uncertainty.

5. **Show citations.**
   Click an evidence row. Explain:
   "A citation is the proof behind a claim. Argus should not ask the customer to trust raw AI
   text."

6. **Show dissent.**
   Explain:
   "Counsel challenges the first hypothesis. If important evidence is missing, confidence goes down
   instead of pretending the answer is certain."

7. **Show setup gaps honestly.**
   If GitHub, metrics, logs, or traces are not configured, say:
   "Argus records missing integrations as evidence gaps. It does not fabricate evidence."

8. **Close with beta scope.**
   "For a first deployment, we start with one service and one evidence source. The success measure is
   whether Argus produces useful cited reports on your real recurring incidents."

## What To Say When Confidence Is Low

Low confidence is not always failure. Say:

```text
Argus lowers confidence when evidence is missing or dissent remains unresolved. That is a
product feature: it tells the team not to over-trust weak evidence.
```

Then explain which integration would raise confidence:

- GitHub for code/deploy evidence.
- Prometheus for metric evidence.
- Loki for log evidence.
- Tempo for trace evidence.

## Follow-Up Email Template

Subject:

```text
Argus beta follow-up
```

Body:

```text
Thanks for reviewing Argus.

The product is designed to turn incidents into citation-backed investigation reports. The important
parts are:

- a clear likely cause,
- evidence citations behind each claim,
- dissent when the hypothesis is weak,
- confidence that goes down when evidence is missing,
- recommended next actions.

For a first beta, we should connect one service and one evidence source. The recommended starting
point is GitHub deploy/code evidence or Prometheus metrics, depending on which incident type you
want to investigate first.

To prepare, please share:

1. one service you want Argus to investigate,
2. one recent or recurring incident pattern,
3. whether GitHub, Prometheus, Loki, or Tempo is easiest to connect first,
4. who should receive the dashboard URL and API key.
```

## Beta Onboarding Checklist

- [ ] Choose one company/service for the first beta.
- [ ] Decide if the deployment is hosted by you or inside the customer's environment.
- [ ] Create or confirm dashboard URL.
- [ ] Create or confirm API URL.
- [ ] Generate or confirm API key.
- [ ] Connect first evidence source, preferably GitHub or Prometheus.
- [ ] Run `pnpm demo:v1`.
- [ ] Open the dashboard and confirm the `demo-*` investigation appears.
- [ ] Explain known limitations before they test with real incidents.
- [ ] Ask the customer to send one real incident payload.
