import { sessionsRouter, userRouter } from "./routers"
import { router } from "./trpc"

export const appRouter = router({
  user: userRouter,
  sessions: sessionsRouter,
})

// Export type definition of the API
export type AppRouter = typeof appRouter
