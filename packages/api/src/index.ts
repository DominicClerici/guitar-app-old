// Main exports for the API package
export { appRouter, type AppRouter } from "./root"
export { createTRPCContext, type Context, type AuthedContext } from "./context"
export {
  router,
  publicProcedure,
  protectedProcedure,
  createCallerFactory,
} from "./trpc"

// Re-export routers for direct access if needed
export * from "./routers"
