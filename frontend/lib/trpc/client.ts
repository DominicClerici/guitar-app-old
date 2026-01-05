import { createTRPCClient, httpBatchLink } from "@trpc/client"
import type { AppRouter } from "@guitar/api"
import superjson from "superjson"

function getBaseUrl() {
  if (typeof window !== "undefined") {
    // Browser should use relative URL
    return ""
  }

  // SSR should use Vercel URL or localhost
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return `http://localhost:${process.env.PORT ?? 3000}`
}

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      async headers() {
        // Headers will be added by the TRPCProvider for authenticated requests
        return {}
      },
    }),
  ],
})
