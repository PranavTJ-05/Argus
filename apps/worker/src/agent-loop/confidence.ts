export type ConfidenceInputs = {
  evidenceSupport: number
  criticMeanCredibility: number
  unresolvedDissentStrength: number
}

export function computeConfidence(input: ConfidenceInputs): number {
  const raw =
    clamp(input.evidenceSupport) * 0.6 +
    clamp(input.criticMeanCredibility) * 0.3 -
    clamp(input.unresolvedDissentStrength) * 0.4

  return roundToTwoDecimals(clamp(raw))
}

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}
