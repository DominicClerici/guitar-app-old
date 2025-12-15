import { config } from "dotenv"
import type { NextConfig } from "next"

// Load environment variables from root .env file
if (process.env.NODE_ENV !== "production") {
  config({ path: "../.env" })
}
const nextConfig: NextConfig = {
  /* config options here */
}

export default nextConfig
