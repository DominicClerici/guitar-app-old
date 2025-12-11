import { config } from "dotenv"
import { drizzle } from "drizzle-orm/postgres-js"
import { resolve } from "path"
import postgres from "postgres"
import * as schema from "./schema"

// Load environment variables from root .env file (won't override existing env vars)
config({ path: resolve(__dirname, "../../../.env") })

// Create the connection
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required")
}

// Create the postgres client
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

// Create the drizzle database instance
export const db = drizzle({ client, schema })
export * from "./schema"
export * from "drizzle-orm"
