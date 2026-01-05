import { userRouter } from "./routers"
import { router } from "./trpc"

export const appRouter = router({
  user: userRouter,
})

// Export type definition of the API
export type AppRouter = typeof appRouter
