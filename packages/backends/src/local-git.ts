import { execFile } from "node:child_process"

import { type JsonValue, jsonValueSchema } from "@argus/shared-types"
import { z } from "zod"

import {
  type BackendLimits,
  enforceResultLimit,
  mergeBackendLimits,
  withTimeout,
} from "./limits.js"

const localGitSearchSchema = z
  .object({
    commitSha: z.string().trim().min(1).optional(),
    maxMatches: z.number().int().positive().max(100).default(20),
    pattern: z.string().trim().min(1),
    path: z.string().trim().min(1).optional(),
    pathHints: z.array(z.string().trim().min(1)).max(5).optional(),
  })
  .strict()

export type LocalGitSearch = z.input<typeof localGitSearchSchema>

export type LocalGitCodeBackend = {
  searchCode: (query: LocalGitSearch) => Promise<JsonValue>
}

export type LocalGitCodeBackendOptions = {
  limits?: Partial<BackendLimits> | undefined
  repoPath: string
}

export function createLocalGitCodeBackend(
  options: LocalGitCodeBackendOptions,
): LocalGitCodeBackend {
  const repoPath = z.string().trim().min(1).parse(options.repoPath)
  const limits = mergeBackendLimits(options.limits)

  return {
    async searchCode(query) {
      const parsed = localGitSearchSchema.parse(query)
      const scopedPath = parsed.path ?? parsed.pathHints?.[0]
      const args = [
        "--json",
        "--max-count",
        parsed.maxMatches.toString(),
        parsed.pattern,
        ...(scopedPath ? [scopedPath] : []),
      ]
      const { stdout } = await withTimeout(
        execFileAsync("rg", args, repoPath),
        limits.timeoutMs,
        "local git code search",
      )
      const lines = stdout
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .slice(0, parsed.maxMatches)
        .map((line) => jsonValueSchema.parse(JSON.parse(line)))

      return enforceResultLimit(
        jsonValueSchema.parse({
          matches: lines,
          pattern: parsed.pattern,
        }),
        limits.maxResultBytes,
        "local git code search",
      )
    },
  }
}

function execFileAsync(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      if (error && stdout.length === 0) {
        reject(error)
        return
      }

      resolve({ stdout, stderr })
    })
  })
}
