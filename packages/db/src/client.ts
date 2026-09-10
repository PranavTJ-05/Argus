import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema.js"

export type ArgusDatabase = PostgresJsDatabase<typeof schema>

export type DatabaseClient = {
  db: ArgusDatabase
  close: () => Promise<void>
}

export function createDatabaseClient(databaseUrl: string): DatabaseClient {
  const sql = postgres(databaseUrl, {
    max: 10,
  })

  return {
    db: drizzle(sql, { schema }),
    close: () => sql.end({ timeout: 5 }),
  }
}
