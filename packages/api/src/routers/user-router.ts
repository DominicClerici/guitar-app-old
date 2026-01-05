import { signUpZod } from "@guitar/schemas"
import { TRPCError } from "@trpc/server"
import { publicProcedure, router } from "../trpc"
import getUserInfo from "../user/getUserInfo"
import registerUser from "../user/registerUser"

export const userRouter = router({
  // Get the current authenticated user's profile
  getUserInfo: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id ?? null
    if (!userId) {
      // This is where it is failing on the server
      return null
    }
    return await getUserInfo(userId)
  }),
  registerUser: publicProcedure.input(signUpZod).mutation(async ({ ctx, input }) => {
    if (ctx.user) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are already registered",
      })
    }

    return await registerUser(input, ctx.supabase)
  }),
})
