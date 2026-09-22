import { describe, expect, it } from "vitest"

import { assertNotCancelled } from "./cancellation.js"

describe("cancellation policy", () => {
  it("allows non-cancelled statuses", () => {
    expect(() => assertNotCancelled("running")).not.toThrow()
    expect(() => assertNotCancelled("completed")).not.toThrow()
    expect(() => assertNotCancelled("failed")).not.toThrow()
  })

  it("rejects cancelled investigations", () => {
    expect(() => assertNotCancelled("cancelled")).toThrow("investigation cancelled")
  })
})
