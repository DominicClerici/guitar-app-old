import { createClient } from "@/lib/supabase/server"
import { appRouter, createTRPCContext } from "@guitar/api"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"

const handler = async (req: Request) => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) {
    console.error(`Error getting claims: ${error?.message ?? "No claims found"}`)
  }

  const claims = data?.claims ? ({ ...data?.claims, id: data?.claims?.sub ?? "" } as any) : null

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers, user: claims, supabase }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(`❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`)
          }
        : undefined,
  })
}

export { handler as GET, handler as POST }
