import type { JsonValue } from "@argus/shared-types"
import { z } from "zod"

import { type FetchLike, fetchJson } from "./http.js"
import type { BackendLimits } from "./limits.js"

const githubActionsQuerySchema = z
  .object({
    branch: z.string().trim().min(1).optional(),
    event: z.string().trim().min(1).optional(),
    perPage: z.number().int().positive().max(100).default(20),
    status: z
      .enum([
        "completed",
        "action_required",
        "cancelled",
        "failure",
        "neutral",
        "skipped",
        "stale",
        "success",
        "timed_out",
        "in_progress",
        "queued",
        "requested",
        "waiting",
      ])
      .optional(),
  })
  .strict()

export type GitHubActionsQuery = z.input<typeof githubActionsQuerySchema>

export type GitHubActionsDeployBackend = {
  listWorkflowRuns: (query?: GitHubActionsQuery) => Promise<JsonValue>
}

export type GitHubActionsDeployBackendOptions = {
  fetchImpl?: FetchLike | undefined
  limits?: Partial<BackendLimits> | undefined
  owner: string
  repo: string
  token: string
}

export function createGitHubActionsDeployBackend(
  options: GitHubActionsDeployBackendOptions,
): GitHubActionsDeployBackend {
  const owner = z.string().trim().min(1).parse(options.owner)
  const repo = z.string().trim().min(1).parse(options.repo)
  const token = z.string().trim().min(1).parse(options.token)

  return {
    async listWorkflowRuns(query = {}) {
      const parsed = githubActionsQuerySchema.parse(query)
      const url = new URL(`https://api.github.com/repos/${owner}/${repo}/actions/runs`)
      url.searchParams.set("per_page", parsed.perPage.toString())

      if (parsed.branch) {
        url.searchParams.set("branch", parsed.branch)
      }

      if (parsed.event) {
        url.searchParams.set("event", parsed.event)
      }

      if (parsed.status) {
        url.searchParams.set("status", parsed.status)
      }

      return fetchJson(url, {
        fetchImpl: options.fetchImpl,
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": "2022-11-28",
        },
        limits: options.limits,
      })
    },
  }
}
