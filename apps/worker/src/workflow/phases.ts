import type { Phase } from "@argus/shared-types"

const phaseOrder: readonly Phase[] = ["triage", "trace", "verdict", "done"]

export function getNextPhase(phase: Phase): Phase {
  const index = phaseOrder.indexOf(phase)

  if (index === -1) {
    throw new Error(`unknown phase: ${phase}`)
  }

  return phaseOrder[Math.min(index + 1, phaseOrder.length - 1)] ?? "done"
}
