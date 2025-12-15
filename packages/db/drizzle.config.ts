import dotenv from "dotenv"
import { defineConfig } from "drizzle-kit"
import { resolve } from "path"

// Load environment variables from root .env file
dotenv.config({ path: resolve(__dirname, "../../.env") })

export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "../../supabase/migrations",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: false,
  strict: false,
})
