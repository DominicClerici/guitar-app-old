import { createClient } from "@/lib/supabase/client"
import type { AppRouter } from "@guitar/api"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import superjson from "superjson"

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return ""
  }

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
        if (typeof window === "undefined") {
          return {}
        }

        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.access_token) {
          return {
            Authorization: `Bearer ${session.access_token}`,
          }
        }

        return {}
      },
    }),
  ],
})
