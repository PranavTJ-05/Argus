# Product Concepts

Argus is an incident reasoning system. It is not a general chatbot over logs. The product value
comes from turning incident context into an auditable report where claims, dissent, and confidence are
visible.

## Investigation

An investigation starts when a customer's alerting system, runbook, CI job, or backend calls:

```http
POST /investigations
Authorization: Bearer <WORKSPACE_API_KEY>
```

The request includes an incident ID and trigger payload: summary, service, environment, time window,
deploy hints, metric query, log query, code pattern, and optional feature flag context.

Argus runs a durable workflow:

```text
TRIAGE -> TRACE -> VERDICT
```

## Citation

A citation is the link between a report claim and the evidence behind that claim.

Examples:

- A report says p95 latency increased. The citation points to a metric or trace tool call result.
- A report says a deploy overlapped the incident. The citation points to a deploy lookup result.
- A report says evidence is missing. The citation points to an evidence gap recorded by the workflow.

If a claim has no citation, the user should treat it as weak. v1 is designed to surface this instead
of hiding it.

## Confidence

Confidence is not the LLM saying "I feel 80% sure." Argus computes confidence from evidence
quality, critic credibility, and unresolved dissent:

```text
confidence = clamp(
  evidence_support * 0.60
  + critic_mean_credibility * 0.30
  - unresolved_dissent_strength * 0.40,
  0,
  1
)
```

High confidence means the evidence chain supports the verdict and dissent is weak or resolved. Low
confidence can be correct behavior when observability credentials are missing or evidence disagrees.

## Dissent

Counsel argues against the current hypothesis. Dissent is useful because production incidents often
have misleading first signals.

Dissent can say:

- another cause also fits the evidence;
- deploy timing is suspicious but not conclusive;
- important evidence is missing;
- the blast radius does not match the hypothesis.

Unresolved dissent lowers confidence and stays visible in the dashboard.

## Setup Gap

A setup gap is a missing or unavailable evidence source. For example:

- GitHub is not configured, so code/deploy evidence cannot be fetched.
- Prometheus is not configured, so metric evidence is unavailable.
- Loki or Tempo returns no matching data for the incident window.

Setup gaps are not silent failures. They appear as evidence gaps so the customer knows why the
report is less certain.

## Customer Workflow

1. Customer signs up and creates a workspace.
2. Customer creates a workspace API key in **Setup**.
3. Customer configures integrations such as GitHub, Prometheus, Loki, and Tempo.
4. Customer sends incidents to `POST /investigations`.
5. Argus runs the agent workflow and persists live events, evidence, dissent, and the report.
6. Customer reviews the result in the dashboard.

For endpoint details, see `docs/INTEGRATION_GUIDE.md`.
