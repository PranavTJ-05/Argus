# Account Controls

Argus v1 uses manual billing and operator-reviewed account controls. The product still needs
hard stop behavior so a workspace cannot create unlimited investigations after a billing, abuse, or
security problem.

## Workspace Status

- `active`: workspace can create investigations and read historical investigations.
- `suspended`: workspace cannot create new investigations, but can still read historical
  investigations.
- `disabled`: workspace cannot create new investigations. Operator review is required before
  reactivation.

Historical read access for suspended workspaces is intentional for v1. It lets a customer export or
review prior incident reports while billing or account questions are resolved.

## Usage Tracked

The account API exposes per-workspace totals for:

- investigation count by status,
- model input and output tokens,
- estimated model cost,
- total LLM duration,
- average completed workflow latency.

These numbers are operational guardrails, not a billing ledger. For launch billing, reconcile them
manually with provider invoices before charging a customer.

## Rate Limits

Investigation creation is rate limited by workspace/API key identity. This protects shared
infrastructure while keeping usage isolated between workspaces.

## Operator Runbook

1. Review `/workspace/account` from the dashboard Setup panel for usage and failed runs.
2. If a customer should keep read access but stop new work, set status to `suspended`.
3. If the workspace needs stronger intervention, set status to `disabled`.
4. Resolve billing, abuse, or security review outside the app.
5. Set status back to `active` when the workspace can create investigations again.
