import { and, db, eq, moduleCompletionsTable } from "@guitar/db"
import { getLessonProgressZod, z } from "@guitar/schemas"

export default async function getLessonProgress(
  input: z.infer<typeof getLessonProgressZod>,
  userId: string,
) {
  const completions = await db
    .select({
      moduleId: moduleCompletionsTable.moduleId,
      completedAt: moduleCompletionsTable.completedAt,
    })
    .from(moduleCompletionsTable)
    .where(
      and(
        eq(moduleCompletionsTable.userId, userId),
        eq(moduleCompletionsTable.path, input.path),
        eq(moduleCompletionsTable.lesson, input.lesson),
      ),
    )

  return completions
}
