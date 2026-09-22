import { describe, expect, it } from "vitest"

import { computeConfidence } from "./confidence.js"

describe("computeConfidence", () => {
  it("uses evidence support, critic credibility, and dissent strength", () => {
    expect(
      computeConfidence({
        evidenceSupport: 1,
        criticMeanCredibility: 0.86,
        unresolvedDissentStrength: 0,
      }),
    ).toBe(0.86)
  })

  it("reduces confidence for unresolved dissent", () => {
    expect(
      computeConfidence({
        evidenceSupport: 1,
        criticMeanCredibility: 0.86,
        unresolvedDissentStrength: 0.45,
      }),
    ).toBe(0.68)
  })

  it("clamps the computed confidence to 0..1", () => {
    expect(
      computeConfidence({
        evidenceSupport: 2,
        criticMeanCredibility: 2,
        unresolvedDissentStrength: -1,
      }),
    ).toBe(0.9)

    expect(
      computeConfidence({
        evidenceSupport: 0,
        criticMeanCredibility: 0,
        unresolvedDissentStrength: 2,
      }),
    ).toBe(0)
  })
})
