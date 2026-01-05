// Main exports for the API package
export { createTRPCContext, type AuthedContext, type Context } from "./context"
export { appRouter, type AppRouter } from "./root"
export { createCallerFactory, protectedProcedure, publicProcedure, router } from "./trpc"

// Re-export routers for direct access if needed
export * from "./routers"
