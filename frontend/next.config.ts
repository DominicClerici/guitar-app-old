import { config } from "dotenv"
import type { NextConfig } from "next"

// Load environment variables from root .env file
if (process.env.NODE_ENV !== "production") {
  config({ path: "../.env" })
}
const nextConfig: NextConfig = {
  transpilePackages: ["@guitar/db", "@guitar/schemas", "@guitar/chord-detection"],
}

export default nextConfig
