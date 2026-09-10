import { describe, expect, it } from "vitest"

import {
  agentOutputs,
  authSessions,
  investigationEventTypeEnum,
  investigationEvents,
  investigationStatusEnum,
  investigations,
  phaseEnum,
  toolCalls,
  users,
  workspaceIntegrationProviderEnum,
  workspaceIntegrations,
  workspaceMemberships,
  workspaceRoleEnum,
  workspaceStatusEnum,
  workspaces,
} from "./schema.js"

describe("database schema", () => {
  it("defines the core investigation enums", () => {
    expect(investigationStatusEnum.enumValues).toEqual([
      "running",
      "completed",
      "failed",
      "cancelled",
    ])
    expect(phaseEnum.enumValues).toEqual(["triage", "trace", "verdict", "done"])
    expect(workspaceRoleEnum.enumValues).toEqual(["admin", "engineer", "viewer"])
    expect(workspaceStatusEnum.enumValues).toEqual(["active", "suspended", "disabled"])
    expect(workspaceIntegrationProviderEnum.enumValues).toEqual([
      "github",
      "prometheus",
      "loki",
      "tempo",
      "launchdarkly",
    ])
    expect(investigationEventTypeEnum.enumValues).toContain("artifact_written")
  })

  it("exports core tables used by workflow idempotency and replay", () => {
    expect(investigations).toBeDefined()
    expect(toolCalls).toBeDefined()
    expect(agentOutputs).toBeDefined()
    expect(investigationEvents).toBeDefined()
    expect(users).toBeDefined()
    expect(workspaces).toBeDefined()
    expect(workspaceMemberships).toBeDefined()
    expect(authSessions).toBeDefined()
    expect(workspaceIntegrations).toBeDefined()
  })
})
