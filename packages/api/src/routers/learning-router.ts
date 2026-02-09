import { completeModuleZod, getLessonProgressZod } from "@guitar/schemas"
import completeModule from "../learning/completeModule"
import getLessonProgress from "../learning/getLessonProgress"
import { protectedProcedure, router } from "../trpc"

export const learningRouter = router({
  completeModule: protectedProcedure.input(completeModuleZod).mutation(async ({ ctx, input }) => {
    return await completeModule(input, ctx.user.id)
  }),

  getLessonProgress: protectedProcedure
    .input(getLessonProgressZod)
    .query(async ({ ctx, input }) => {
      return await getLessonProgress(input, ctx.user.id)
    }),
})
