import type { JsonValue } from "@argus/shared-types"
import { z } from "zod"

import { type FetchLike, fetchJson } from "./http.js"
import type { BackendLimits } from "./limits.js"
import type { LocalGitSearch } from "./local-git.js"

export type GitHubCodeBackend = {
  searchCode: (query: LocalGitSearch) => Promise<JsonValue>
}

export type GitHubCodeBackendOptions = {
  fetchImpl?: FetchLike | undefined
  limits?: Partial<BackendLimits> | undefined
  owner: string
  repo: string
  token: string
}

const githubCodeSearchSchema = z
  .object({
    commitSha: z.string().trim().min(1).optional(),
    maxMatches: z.number().int().positive().max(100).default(20),
    pattern: z.string().trim().min(1),
    path: z.string().trim().min(1).optional(),
    pathHints: z.array(z.string().trim().min(1)).max(5).optional(),
  })
  .strict()

export function createGitHubCodeBackend(options: GitHubCodeBackendOptions): GitHubCodeBackend {
  const owner = z.string().trim().min(1).parse(options.owner)
  const repo = z.string().trim().min(1).parse(options.repo)
  const token = z.string().trim().min(1).parse(options.token)

  return {
    async searchCode(query) {
      const parsed = githubCodeSearchSchema.parse(query)
      const url = new URL("https://api.github.com/search/code")
      const scopedPath = parsed.path ?? parsed.pathHints?.[0]
      const terms = [`repo:${owner}/${repo}`, parsed.pattern]

      if (scopedPath) {
        terms.push(`path:${scopedPath}`)
      }

      url.searchParams.set("q", terms.join(" "))
      url.searchParams.set("per_page", Math.min(parsed.maxMatches, 25).toString())

      const result = await fetchJson(url, {
        fetchImpl: options.fetchImpl,
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": "2022-11-28",
        },
        limits: options.limits,
      })

      return {
        owner,
        commitSha: parsed.commitSha ?? null,
        pattern: parsed.pattern,
        repo,
        result,
        source: "github_code_search",
        scopedPath: scopedPath ?? null,
      }
    },
  }
}
