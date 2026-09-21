import type { AgentRole } from "@argus/shared-types"

const stepKeyPartPattern = /^[a-z][a-z0-9_]*$/

export function roundStepKey(round: number, role: AgentRole): string {
  assertRound(round)
  assertStepKeyPart(role)

  return `r${round}-${role}`
}

export function expertStepKey(round: number, expertName: AgentRole): string {
  assertRound(round)
  assertStepKeyPart(expertName)

  return `r${round}-expert-${expertName}`
}

export function reporterStepKey(): string {
  return "reporter"
}

function assertRound(round: number): void {
  if (!Number.isInteger(round) || round < 0) {
    throw new Error(`invalid round for step_key: ${round}`)
  }
}

function assertStepKeyPart(value: string): void {
  if (!stepKeyPartPattern.test(value)) {
    throw new Error(`invalid step_key part: ${value}`)
  }
}
