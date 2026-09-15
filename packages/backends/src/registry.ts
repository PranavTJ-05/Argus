import { type DeployBackend, type DeployRecord, createMockDeployBackend } from "./deploy.js"
import {
  type GitHubActionsDeployBackend,
  createGitHubActionsDeployBackend,
} from "./github-actions.js"
import { type GitHubCodeBackend, createGitHubCodeBackend } from "./github-code.js"
import { type LocalGitCodeBackend, createLocalGitCodeBackend } from "./local-git.js"
import { type LokiLogBackend, createLokiLogBackend } from "./loki.js"
import { type PrometheusMetricBackend, createPrometheusMetricBackend } from "./prometheus.js"
import { type TempoTraceSource, createTempoTraceSource } from "./tempo.js"

export type ArgusBackendRegistry = {
  code?: GitHubCodeBackend | LocalGitCodeBackend
  deploys?: DeployBackend
  githubActions?: GitHubActionsDeployBackend
  logs?: LokiLogBackend
  metrics?: PrometheusMetricBackend
  traces?: TempoTraceSource
}

export type ArgusBackendRegistryOptions = {
  github?:
    | {
        owner: string
        repo: string
        token: string
      }
    | undefined
  localRepoPath?: string | undefined
  lokiEndpoint?: string | undefined
  mockDeployments?: DeployRecord[] | undefined
  prometheusEndpoint?: string | undefined
  tempoEndpoint?: string | undefined
}

export function createArgusBackendRegistry(
  options: ArgusBackendRegistryOptions,
): ArgusBackendRegistry {
  const registry: ArgusBackendRegistry = {}

  if (options.tempoEndpoint) {
    registry.traces = createTempoTraceSource({ endpoint: options.tempoEndpoint })
  }

  if (options.lokiEndpoint) {
    registry.logs = createLokiLogBackend({ endpoint: options.lokiEndpoint })
  }

  if (options.prometheusEndpoint) {
    registry.metrics = createPrometheusMetricBackend({ endpoint: options.prometheusEndpoint })
  }

  if (options.mockDeployments) {
    registry.deploys = createMockDeployBackend({ deployments: options.mockDeployments })
  }

  if (options.github) {
    registry.githubActions = createGitHubActionsDeployBackend(options.github)
    registry.code = createGitHubCodeBackend(options.github)
  }

  if (!registry.code && options.localRepoPath) {
    registry.code = createLocalGitCodeBackend({ repoPath: options.localRepoPath })
  }

  return registry
}
