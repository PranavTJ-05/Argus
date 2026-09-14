import { describe, expect, it } from "vitest"

import { StrictJsonGenerationError } from "./index.js"

describe("StrictJsonGenerationError", () => {
  it("carries the validation error separately from the message", () => {
    const error = new StrictJsonGenerationError("failed", "missing field")

    expect(error.message).toBe("failed")
    expect(error.validationError).toBe("missing field")
  })
})
