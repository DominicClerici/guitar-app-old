import { db, sessionsTable, type ScaleSessionData } from "@guitar/db"
import { saveNewSessionZod, z } from "@guitar/schemas"

export default async function saveNewSession(
  input: z.infer<typeof saveNewSessionZod>,
  userId: string,
) {
  const sessionData: ScaleSessionData = {
    type: "scales",
    key: input.sessionData.key,
    shapes: input.sessionData.shapes,
    shapesCompleted: input.sessionData.shapesCompleted,
    totalNotesPlayed: input.sessionData.totalNotesPlayed,
    ...(input.sessionData.speedWindows && { speedWindows: input.sessionData.speedWindows }),
    ...(input.sessionData.shapeCompletionTimes && {
      shapeCompletionTimes: input.sessionData.shapeCompletionTimes,
    }),
  }

  const [session] = await db
    .insert(sessionsTable)
    .values({
      userId,
      duration: input.duration,
      type: input.type,
      timingMode: input.timingMode,
      keys: input.keys,
      sessionData,
    })
    .returning({ id: sessionsTable.id })

  return { id: session!.id }
}
