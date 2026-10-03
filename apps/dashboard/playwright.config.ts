import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:3002",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3002",
    reuseExistingServer: true,
    timeout: 120_000,
    url: "http://127.0.0.1:3002",
  },
})
