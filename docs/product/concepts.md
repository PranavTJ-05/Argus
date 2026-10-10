# Core Concepts

Argus is an incident reasoning system, not a chatbot over logs. Its value is an auditable report where claims, objections and confidence are all visible.

## Investigation

Started when an alerting system, runbook, CI job or backend calls `POST /investigations` with an incident ID and a trigger payload (summary, service, environment, time window, deploy hints, queries, optional flag context). A durable workflow then runs `TRIAGE -> TRACE -> VERDICT`.

## Citation

A link from a report claim to its evidence: a metric or trace result for a latency claim, a deploy lookup for a deploy claim, a recorded gap for a "we could not check this" claim. A claim without a citation should be treated as weak, and Argus surfaces that rather than hiding it.

## Confidence

Computed from evidence quality, Critic credibility and unresolved dissent, not from the model's own certainty:

```text
confidence = clamp(evidence_support*0.60 + critic_mean_credibility*0.30 - unresolved_dissent_strength*0.40, 0, 1)
```

High confidence means the evidence chain supports the verdict and objections are weak or resolved. Low confidence is often the correct answer when integrations are missing or evidence conflicts.

## Dissent

Counsel argues against the current hypothesis because early signals in an incident are often misleading. Typical objections: another cause fits, deploy timing is suspicious but not conclusive, key evidence is missing, or blast radius does not match. Unresolved dissent lowers confidence and stays visible.

## Setup gap

A missing or unusable evidence source (GitHub not connected, no Prometheus, Loki or Tempo returned nothing for the window). Gaps appear in the report so readers know why it is less certain.

## Customer journey

1. Sign up and create a workspace.
2. Create a workspace API key in **Setup**.
3. Connect integrations (GitHub first).
4. Send incidents to `POST /investigations`.
5. Argus runs the agents and stores events, evidence, dissent and the report.
6. Review the result in the dashboard.

Details: [../guides/api.md](../guides/api.md).
