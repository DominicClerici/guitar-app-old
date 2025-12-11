import { config } from "dotenv"
import type { NextConfig } from "next"
import { resolve } from "path"

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../.env") })

const nextConfig: NextConfig = {
  /* config options here */
}

export default nextConfig
