import { db, moduleCompletionsTable } from "@guitar/db"
import { completeModuleZod, z } from "@guitar/schemas"

export default async function completeModule(
  input: z.infer<typeof completeModuleZod>,
  userId: string,
) {
  await db
    .insert(moduleCompletionsTable)
    .values({
      userId,
      path: input.path,
      lesson: input.lesson,
      moduleId: input.moduleId,
    })
    .onConflictDoNothing()

  return { success: true }
}
