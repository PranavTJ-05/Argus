import { type JsonValue, jsonValueSchema } from "@argus/shared-types"
import { z } from "zod"

import { type BackendLimits, enforceResultLimit, mergeBackendLimits } from "./limits.js"

const deployRecordSchema = z
  .object({
    commitSha: z.string().trim().min(7),
    deployedAt: z.string().datetime(),
    environment: z.string().trim().min(1),
    serviceName: z.string().trim().min(1),
    version: z.string().trim().min(1),
  })
  .strict()

const deployQuerySchema = z
  .object({
    environment: z.string().trim().min(1).optional(),
    serviceName: z.string().trim().min(1),
    since: z.string().datetime().optional(),
    until: z.string().datetime().optional(),
  })
  .strict()

export type DeployRecord = z.infer<typeof deployRecordSchema>
export type DeployQuery = z.input<typeof deployQuerySchema>

export type DeployBackend = {
  listDeploys: (query: DeployQuery) => Promise<JsonValue>
}

export type MockDeployBackendOptions = {
  deployments: DeployRecord[]
  limits?: Partial<BackendLimits> | undefined
}

export function createMockDeployBackend(options: MockDeployBackendOptions): DeployBackend {
  const deployments = z.array(deployRecordSchema).parse(options.deployments)
  const limits = mergeBackendLimits(options.limits)

  return {
    async listDeploys(query) {
      const parsed = deployQuerySchema.parse(query)
      const since = parsed.since ? Date.parse(parsed.since) : Number.NEGATIVE_INFINITY
      const until = parsed.until ? Date.parse(parsed.until) : Number.POSITIVE_INFINITY
      const matching = deployments.filter((deployment) => {
        const deployedAt = Date.parse(deployment.deployedAt)
        return (
          deployment.serviceName === parsed.serviceName &&
          (parsed.environment === undefined || deployment.environment === parsed.environment) &&
          deployedAt >= since &&
          deployedAt <= until
        )
      })

      return enforceResultLimit(
        jsonValueSchema.parse({ deployments: matching }),
        limits.maxResultBytes,
        "mock deploy backend",
      )
    },
  }
}
