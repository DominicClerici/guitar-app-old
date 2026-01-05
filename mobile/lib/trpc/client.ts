import { createTRPCClient, httpBatchLink } from "@trpc/client"
import type { AppRouter } from "@guitar/api/client"
import superjson from "superjson"
import { supabase } from "../supabase/client"

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      transformer: superjson,
      async headers() {
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
