import { describe, expect, it } from "vitest"

import { smokeDataset } from "./datasets/smoke.js"
import { evaluateDataset, formatEvaluationSummary } from "./index.js"

describe("evaluateDataset", () => {
  it("reports accuracy, evidence quality, counsel catch rate, calibration, cost, and latency", () => {
    const summary = evaluateDataset(smokeDataset)

    expect(summary.caseCount).toBe(1)
    expect(summary.metrics.accuracy).toBe(1)
    expect(summary.metrics.evidenceQuality).toBe(0.85)
    expect(summary.metrics.counselCatchRate).toBe(1)
    expect(summary.metrics.calibrationError).toBe(0)
    expect(summary.metrics.totalCostUsd).toBe(0.024)
    expect(summary.metrics.averageLatencyMs).toBe(1840)
  })

  it("compares the candidate report against a baseline", () => {
    const summary = evaluateDataset(smokeDataset)

    expect(summary.metrics.baselineAccuracy).toBe(0.5)
    expect(summary.baselineDelta.accuracy).toBe(0.5)
    expect(summary.baselineDelta.evidenceQuality).toBeGreaterThan(0)
    expect(summary.baselineDelta.calibrationError).toBeGreaterThan(0)
  })

  it("formats a stable summary for CLI output", () => {
    expect(formatEvaluationSummary(evaluateDataset(smokeDataset))).toContain(
      "counsel_catch_rate=1.000",
    )
  })
})
