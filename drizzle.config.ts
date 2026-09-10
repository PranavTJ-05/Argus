import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./packages/db/src/schema.ts",
  out: "./packages/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://argus:argus@localhost:5432/argus",
  },
  strict: true,
  verbose: true,
})
