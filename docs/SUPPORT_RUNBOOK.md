# Support Runbook

This runbook is for operators supporting Argus workspaces after launch. Use it when a customer
reports signup, API key, integration, workflow, or dashboard display problems.

Do not ask customers to paste raw secrets. Use request IDs, workspace IDs, investigation IDs,
incident IDs, and timestamps.

## First Triage

Collect:

- customer workspace name or slug;
- user email if the issue is signup or login;
- dashboard URL and approximate time;
- incident ID or investigation ID if available;
- customer-visible support reference ID from the dashboard, if shown;
- whether the issue is signup, API key, integration, workflow, dashboard display, or report quality.

Open the dashboard Support console and record:

- workspace ID;
- investigation ID;
- latest API request ID;
- Inngest lookup string;
- latest customer error diagnostic, if present.

The Support console is the starting point for v1. It links the customer symptom to the operator
diagnostic without exposing secrets in screenshots or support messages.

## Signup And Login Failures

Customer symptom:

- cannot create a workspace;
- cannot sign in;
- dashboard redirects back to login;
- session appears to work and then disappears.

Checks:

1. Search API logs by the dashboard support reference ID or request ID.
2. Check the response status:
   - `400`: form validation failed; ask the customer to correct email, password, or workspace name.
   - `401`: session missing or expired; ask the customer to sign in again.
   - `409`: workspace or user already exists; direct them to sign in instead of signing up.
   - `429`: workspace or IP is rate limited; wait and retry.
   - `5xx`: inspect API logs and database connectivity.
3. Confirm the workspace status is not `disabled`.
4. Confirm dashboard and API services are deployed from the same release.

Safe operator actions:

- set workspace status back to `active` only after billing, abuse, or security review is complete;
- do not manually create sessions;
- do not ask for the customer's password.

## API Key Failures

Customer symptom:

- `401 unauthorized` when creating an investigation;
- old scripts stopped creating incidents;
- dashboard Setup says no active API key;
- customer lost the raw key.

Checks:

1. Confirm the request uses `Authorization: Bearer <key>` or `X-API-Key: <key>`.
2. In Setup, verify the workspace has an active API key.
3. Check whether the workspace is `active`; suspended and disabled workspaces cannot create new
   investigations.
4. Check API logs by request ID for `unauthorized`, `workspace_suspended`, or `rate_limited`.
5. Confirm the customer is sending the key to the API URL, not the dashboard URL.

Safe operator actions:

- ask the customer to rotate or create a new workspace API key in Setup;
- revoke a leaked key;
- never recover or display an existing raw key, because raw keys are shown only once.

## Integration Failures

Customer symptom:

- report shows low confidence;
- report says GitHub, Prometheus, Loki, Tempo, or LaunchDarkly is not connected;
- evidence row says code, deploy, metric, log, or trace evidence is unavailable;
- GitHub evidence exists but is too broad or empty.

Checks:

1. Open Setup and verify the integration is connected for the customer's workspace.
2. Confirm the investigation payload includes useful hints:
   - `service` or `serviceName`;
   - `environment`;
   - `start` and `end`;
   - `branch`, `deployRef`, or `commitSha`;
   - `codePattern`, `metricQuery`, or `logQuery` where relevant.
3. For GitHub:
   - confirm owner and repo are correct;
   - confirm the token has read access to repository contents;
   - confirm Actions read access if deploy evidence is expected;
   - reduce `codePattern` if code search result size is too large.
4. For Prometheus, Loki, and Tempo:
   - confirm endpoint URLs are reachable from the deployed API/worker network;
   - confirm query syntax matches the customer's backend;
   - confirm the incident time window has data.
5. Read the Evidence tab before blaming the model. Missing integrations should appear as cited
   setup gaps, not invented evidence.

Safe operator actions:

- update or ask the customer to update the integration in Setup;
- rerun by creating a new investigation with better payload context;
- do not copy one workspace's integration credentials into another workspace.

## Workflow Failures

Customer symptom:

- investigation stays running;
- investigation fails;
- report never appears;
- Inngest shows failed function runs;
- Support console shows stuck investigations.

Checks:

1. Open Support console and copy the investigation ID and Inngest lookup string.
2. Search Inngest production runs by:
   - app `argus`;
   - function `investigation-requested`;
   - event `investigation.requested`;
   - payload `investigationId`.
3. Check worker logs around the run start time.
4. Check API logs for the original `POST /investigations` request ID.
5. Inspect `investigation_events` through the Live View to see the last durable step.
6. Check whether the failure is:
   - database write or migration problem;
   - provider rate limit or model error;
   - integration timeout;
   - strict JSON validation failure after repair;
   - cancelled workflow.

Safe operator actions:

- use Support console cancel for stuck running investigations;
- leave retry and resolve disabled until durable retry and persisted operator resolution are
  implemented;
- create a new investigation with corrected context instead of mutating old workflow history;
- preserve failed investigations for audit unless the customer requests deletion under a future
  data-retention policy.

## Dashboard Display Failures

Customer symptom:

- inbox is empty but API created an investigation;
- evidence panel fails to load;
- report loads but cited evidence does not;
- dashboard shows a customer error with a support reference ID;
- layout appears broken on a supported viewport.

Checks:

1. Copy the customer-visible support reference ID.
2. Open Support console and read the latest customer error diagnostic:
   - source;
   - status;
   - request ID;
   - upstream error code;
   - customer-visible message.
3. Search dashboard API proxy logs by request ID.
4. If status is `401` or `403`, confirm the customer is signed in to the correct workspace.
5. If status is `404`, confirm the selected investigation belongs to the workspace and the report
   has been written.
6. If status is `5xx`, inspect API logs and worker/database health.
7. If only visual layout is affected, collect browser, viewport size, and screenshot with secrets
   hidden.

Safe operator actions:

- ask the customer to refresh only after checking whether the API request failed;
- do not ask them to clear all browser storage unless login/session corruption is confirmed;
- if the issue is a missing report, verify workflow status before treating it as a UI bug.

## Report Quality Problems

Customer symptom:

- report is low confidence;
- report says inconclusive;
- report includes unresolved dissent;
- customer says the conclusion is wrong.

Checks:

1. Inspect the Evidence tab and cited tool calls.
2. Confirm each major claim has a citation.
3. Read setup gaps and dissent before treating low confidence as failure.
4. Check whether integrations were configured before the investigation started.
5. Confirm the payload included enough service, time window, deploy, code, metric, log, and trace
   context.

Safe operator actions:

- explain low confidence as a product signal, not a broken report;
- ask for better incident context or missing integration setup;
- create a new investigation after setup is fixed;
- do not edit old report output to make it look more confident.

## Escalation Template

Use this shape when escalating internally:

```text
Customer:
Workspace:
Workspace ID:
Investigation ID:
Incident ID:
Customer-visible error:
Support reference/request ID:
Area: signup | API key | integration | workflow | dashboard | report quality
Observed status:
Last workflow event:
Inngest lookup:
Suspected cause:
Next safe action:
```

## Known v1 Limits

- Inngest provider run ID is not persisted in Argus yet; search by function and event payload
  `investigationId`.
- Retry and manual resolve controls are intentionally disabled until durable replay semantics are
  implemented.
- Missing observability integrations reduce confidence and should appear as cited setup gaps.
- Raw API keys and integration secrets are not recoverable after save.
