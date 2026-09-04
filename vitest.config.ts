import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@argus/config": new URL("./packages/config/src/index.ts", import.meta.url).pathname,
      "@argus/db": new URL("./packages/db/src/index.ts", import.meta.url).pathname,
      "@argus/shared-types": new URL("./packages/shared-types/src/index.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
})
