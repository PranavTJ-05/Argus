import { describe, expect, it } from "vitest"

import { createMockDeployBackend } from "./deploy.js"
import { createGitHubActionsDeployBackend } from "./github-actions.js"
import { createGitHubCodeBackend } from "./github-code.js"
import type { FetchLike } from "./http.js"
import { enforceResultLimit } from "./limits.js"
import { createLokiLogBackend } from "./loki.js"
import { createPrometheusMetricBackend } from "./prometheus.js"
import { createTempoTraceSource } from "./tempo.js"

describe("observability backends", () => {
  it("builds Tempo trace search requests", async () => {
    const requests: string[] = []
    const backend = createTempoTraceSource({
      endpoint: "http://tempo:3200",
      fetchImpl: jsonFetch(requests, { traces: [] }),
    })

    await backend.searchTraces({
      limit: 5,
      serviceName: "checkout",
    })

    expect(requests[0]).toContain("http://tempo:3200/api/search")
    expect(requests[0]).toContain("tags=service.name%3Dcheckout")
    expect(requests[0]).toContain("limit=5")
  })

  it("builds Loki log range requests", async () => {
    const requests: string[] = []
    const backend = createLokiLogBackend({
      endpoint: "http://loki:3100",
      fetchImpl: jsonFetch(requests, { data: { result: [] } }),
    })

    await backend.queryLogs({
      query: '{service="checkout"}',
    })

    expect(requests[0]).toContain("http://loki:3100/loki/api/v1/query_range")
    expect(requests[0]).toContain("query=%7Bservice%3D%22checkout%22%7D")
  })

  it("builds Prometheus metric requests", async () => {
    const requests: string[] = []
    const backend = createPrometheusMetricBackend({
      endpoint: "http://prometheus:9090",
      fetchImpl: jsonFetch(requests, { data: { result: [] } }),
    })

    await backend.queryMetrics({
      query: "histogram_quantile(0.95, checkout_latency_bucket)",
    })

    expect(requests[0]).toContain("http://prometheus:9090/api/v1/query")
    expect(requests[0]).toContain("checkout_latency_bucket")
  })

  it("filters mock deploy records", async () => {
    const backend = createMockDeployBackend({
      deployments: [
        {
          commitSha: "abc1234",
          deployedAt: "2026-05-23T00:00:00.000Z",
          environment: "prod",
          serviceName: "checkout",
          version: "2026.05.23",
        },
        {
          commitSha: "def5678",
          deployedAt: "2026-05-23T00:00:00.000Z",
          environment: "prod",
          serviceName: "billing",
          version: "2026.05.23",
        },
      ],
    })

    await expect(backend.listDeploys({ serviceName: "checkout" })).resolves.toEqual({
      deployments: [
        {
          commitSha: "abc1234",
          deployedAt: "2026-05-23T00:00:00.000Z",
          environment: "prod",
          serviceName: "checkout",
          version: "2026.05.23",
        },
      ],
    })
  })

  it("builds GitHub Actions requests with auth headers", async () => {
    const requests: string[] = []
    const backend = createGitHubActionsDeployBackend({
      fetchImpl: jsonFetch(requests, { workflow_runs: [] }),
      owner: "octo",
      repo: "repo",
      token: "token",
    })

    await backend.listWorkflowRuns({
      branch: "main",
      perPage: 10,
      status: "completed",
    })

    expect(requests[0]).toBe(
      "https://api.github.com/repos/octo/repo/actions/runs?per_page=10&branch=main&status=completed",
    )
  })

  it("builds GitHub code search requests with repository scope", async () => {
    const requests: string[] = []
    const backend = createGitHubCodeBackend({
      fetchImpl: jsonFetch(requests, { items: [] }),
      owner: "octo",
      repo: "repo",
      token: "token",
    })

    await backend.searchCode({
      maxMatches: 10,
      pattern: "payment_authorize",
    })

    expect(requests[0]).toBe(
      "https://api.github.com/search/code?q=repo%3Aocto%2Frepo+payment_authorize&per_page=10",
    )
  })

  it("scopes GitHub code search by path hints and caps page size", async () => {
    const requests: string[] = []
    const backend = createGitHubCodeBackend({
      fetchImpl: jsonFetch(requests, { items: [] }),
      owner: "octo",
      repo: "repo",
      token: "token",
    })

    await backend.searchCode({
      commitSha: "abc1234",
      maxMatches: 100,
      pathHints: ["apps/dashboard"],
      pattern: "@argus/shared-types",
    })

    expect(requests[0]).toBe(
      "https://api.github.com/search/code?q=repo%3Aocto%2Frepo+%40argus%2Fshared-types+path%3Aapps%2Fdashboard&per_page=25",
    )
  })

  it("rejects oversized results", () => {
    expect(() => enforceResultLimit({ body: "too-large" }, 4, "test backend")).toThrow(
      "test backend result exceeded 4 bytes",
    )
  })
})

function jsonFetch(requests: string[], value: unknown): FetchLike {
  return async (input) => {
    requests.push(input.toString())

    return new Response(JSON.stringify(value), {
      status: 200,
      statusText: "OK",
    })
  }
}
