# Evidence Integrations

Argus is only as sharp as the evidence it can reach. Each workspace connects its own sources in the dashboard **Setup** panel; credentials are encrypted before storage and never returned to the browser.

| Source | Gives | Connect with |
| --- | --- | --- |
| GitHub | Deploy history (Actions runs) and code search | Owner, repo, read token |
| Prometheus | Metric evidence | Endpoint URL |
| Loki | Log evidence | Endpoint URL |
| Tempo | Trace evidence | Endpoint URL |
| Feature flags | Flag context | Not yet available in v1; recorded as skipped evidence |

## Recommended order

1. **GitHub** gives deploy and code context without a full observability rollout.
2. **Prometheus** for metric-backed latency and error reports.
3. **Loki** for logs.
4. **Tempo** for traces.

## GitHub token

Grant read-only repository contents access, plus Actions metadata access if deploy evidence should come from workflow runs. Including `branch`, `deployRef`, `commitSha` and `codePattern` in the incident payload makes results more precise.

## Behavior when something is missing

- Unconfigured or unreachable sources, empty results and permission errors are recorded as cited evidence gaps.
- Gaps separate "not configured", "query failed", "no data" and "result too large".
- A workspace never uses another workspace's credentials, nor global deployment credentials.
- Fewer sources means lower confidence, which is intended behavior.
