# Operations Runbook

Day-two procedures for operators. Never ask customers for raw secrets; work from workspace IDs, investigation IDs, incident IDs, request IDs and timestamps.

## 1. Release gate

Before tagging a release:

```bash
pnpm check
pnpm format:check
pnpm eval:full
pnpm smoke:launch
git diff --check
```

Record eval results in [../product/launch-readiness.md](../product/launch-readiness.md), then tag after the release commit is on the release branch:

```bash
git tag -a v1.0.0-launch -m "Argus v1 launch"
git push origin v1.0.0-launch
```

## 2. Monitoring

Watch API 4xx and 5xx rates, worker and Inngest failures, failed investigations, model spend, Postgres availability and storage, and evidence setup gaps. Health endpoints are listed in [deployment.md](deployment.md#health-checks).

## 3. Support triage

Collect: workspace name or slug, dashboard URL and time, incident or investigation ID, the support reference shown in the dashboard, and the area (signup, API key, integration, workflow, dashboard, report quality). Open the dashboard **Support console** to get the workspace ID, investigation ID, latest request ID and Inngest lookup string.

First response checklist:

1. Check API, dashboard, worker, Postgres and Inngest health.
2. Check workspace status (active, suspended, disabled) and API key state.
3. Read investigation events and terminal status.
4. Read evidence gaps before blaming the model.
5. Read worker logs for provider, database and integration errors.

### Symptom guide

| Area | Check | Safe action |
| --- | --- | --- |
| Signup or login | Status: 400 bad form, 401 expired session, 409 already exists, 429 rate limited, 5xx logs and database | Reactivate a workspace only after review; never create sessions or ask for passwords |
| API key | `Authorization` header format, active key in Setup, workspace status, request ID for `unauthorized`, `workspace_suspended` or `rate_limited`, and that the key goes to the API URL | Have the customer rotate or revoke; raw keys cannot be recovered |
| Integration | Setup shows it connected; payload has service, environment, time window and hints; GitHub owner, repo and scopes; backend reachable and query valid; data exists in the window | Fix the integration and run a new investigation; never copy credentials between workspaces |
| Workflow | Support console lookup, Inngest runs for `investigation-requested`, worker and API logs, last durable event; classify as database, provider limit, integration timeout, JSON validation, or cancelled | Cancel stuck runs from the console; start a fresh investigation instead of editing history |
| Dashboard display | Support reference and latest customer error diagnostic; 401/403 wrong workspace, 404 missing report, 5xx upstream health | Confirm the API call failed before suggesting a refresh |
| Report quality | Evidence tab, citations on major claims, gaps and dissent, integrations configured beforehand, payload context | Explain low confidence as a signal; never edit old reports |

Retry and manual-resolve controls stay disabled until durable replay semantics exist. The Inngest run ID is not stored yet, so search by function and `investigationId`.

### Escalation template

```text
Customer / Workspace / Workspace ID:
Investigation ID / Incident ID:
Customer-visible error and support reference:
Area: signup | API key | integration | workflow | dashboard | report quality
Observed status and last workflow event:
Inngest lookup:
Suspected cause and next safe action:
```

## 4. Platform incidents

1. Stop new work by suspending affected workspaces or revoking affected keys, keeping read access where possible.
2. Inspect Inngest failed runs and worker logs.
3. If a bad deploy is the cause, roll back (below).
4. Run smoke checks before re-enabling writes.
5. Write a short note covering cause, impact and prevention.

## 5. Rollback

- **Code:** redeploy the previous known-good commit or image; never run destructive migrations while rolling back; run health checks and `pnpm smoke:launch`; watch failed runs and retries.
- **Data:** if a migration damaged data, restore the managed Postgres backup taken before it.
- **Access:** revoke leaked keys, suspend a workspace for abuse or billing risk, disable only when both writes and dashboard access must stop.
- **Quick stop for a beta:** rotate or remove the key, disable the customer's webhook, pause the worker, keep the database for debugging, and tell the customer which runs may be incomplete.

## 6. Account controls

| Status | Can create investigations | Can read history |
| --- | --- | --- |
| `active` | yes | yes |
| `suspended` | no | yes |
| `disabled` | no | operator review required before reactivation |

The account API reports per workspace: investigations by status, input and output tokens, estimated cost, LLM duration and average workflow latency. These are guardrails, not a billing ledger; reconcile with provider invoices before charging.

Procedure: review `/workspace/account`, suspend to stop new work, disable for stronger intervention, resolve the underlying issue, then set the status back to `active`.

## 7. Customer handoff

Provide the dashboard URL, API URL, signup or login steps, API key creation steps, the [API guide](../guides/api.md), and an explanation of citations, confidence, dissent and setup gaps from [../product/concepts.md](../product/concepts.md). Suggest connecting GitHub first, then Prometheus, Loki and Tempo.

## 8. Private beta checklist

- [ ] One company, one service, one recurring incident pattern
- [ ] Isolated API, worker, dashboard and database
- [ ] Production variables set and migrations run
- [ ] Inngest synced to the worker
- [ ] First evidence source connected
- [ ] `pnpm smoke:v1` and `pnpm demo:v1` pass
- [ ] Limitations explained and one real payload requested
