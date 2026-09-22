import type { InvestigationStatus } from "@argus/shared-types"

export function assertNotCancelled(status: InvestigationStatus): void {
  if (status === "cancelled") {
    throw new Error("investigation cancelled")
  }
}
