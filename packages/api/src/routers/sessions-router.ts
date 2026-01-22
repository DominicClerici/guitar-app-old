import { saveNewSessionZod } from "@guitar/schemas"
import { TRPCError } from "@trpc/server"
import saveNewSession from "../sessions/saveNewSession"
import { protectedProcedure, router } from "../trpc"

export const sessionsRouter = router({
  saveNewSession: protectedProcedure.input(saveNewSessionZod).mutation(async ({ ctx, input }) => {
    if (!ctx.user) {
      console.error("User not found")
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You are not authorized to save a new session",
      })
    }
    return await saveNewSession(input, ctx.user.id)
  }),
})
