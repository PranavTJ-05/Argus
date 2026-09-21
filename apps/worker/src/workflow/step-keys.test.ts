import { describe, expect, it } from "vitest"

import { expertStepKey, reporterStepKey, roundStepKey } from "./step-keys.js"

describe("step key helpers", () => {
  it("creates deterministic round step keys", () => {
    expect(roundStepKey(1, "director")).toBe("r1-director")
    expect(roundStepKey(2, "critic")).toBe("r2-critic")
    expect(roundStepKey(3, "counsel")).toBe("r3-counsel")
  })

  it("creates deterministic expert step keys", () => {
    expect(expertStepKey(4, "trace_expert")).toBe("r4-expert-trace_expert")
  })

  it("creates the reporter step key", () => {
    expect(reporterStepKey()).toBe("reporter")
  })

  it("rejects invalid rounds", () => {
    expect(() => roundStepKey(-1, "director")).toThrow("invalid round")
    expect(() => roundStepKey(1.5, "director")).toThrow("invalid round")
  })
})
