import { describe, expect, it } from "vitest"

import { assertWithinRoundLimit, maxInvestigationRounds } from "./rounds.js"

describe("round policy", () => {
  it("allows rounds below the limit", () => {
    expect(() => assertWithinRoundLimit(maxInvestigationRounds - 1)).not.toThrow()
  })

  it("rejects rounds at the limit", () => {
    expect(() => assertWithinRoundLimit(maxInvestigationRounds)).toThrow("round limit exceeded")
  })
})
