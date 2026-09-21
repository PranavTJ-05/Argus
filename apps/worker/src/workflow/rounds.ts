export const maxInvestigationRounds = 20

export function assertWithinRoundLimit(round: number): void {
  if (round >= maxInvestigationRounds) {
    throw new Error(`round limit exceeded: ${round}`)
  }
}
