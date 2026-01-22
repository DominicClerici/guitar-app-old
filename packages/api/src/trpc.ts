import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import type { Context } from "./context"

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape
  },
})

export const router = t.router
export const createCallerFactory = t.createCallerFactory

// Public procedure - no auth required, but user is available in ctx if logged in
export const publicProcedure = t.procedure

// Middleware to check if user is authenticated
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    })
  }
  return next({
    ctx: {
      ...ctx,
      // Infers that user is non-null
      user: ctx.user,
    },
  })
})

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(isAuthed)
