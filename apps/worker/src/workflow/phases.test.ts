import { describe, expect, it } from "vitest"

import { getNextPhase } from "./phases.js"

describe("phase advancement", () => {
  it.each([
    ["triage", "trace"],
    ["trace", "verdict"],
    ["verdict", "done"],
    ["done", "done"],
  ] as const)("advances %s to %s", (from, to) => {
    expect(getNextPhase(from)).toBe(to)
  })
})
