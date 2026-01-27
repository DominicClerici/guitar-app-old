import { db, eq, usersMetadataTable, type GuitarTuning } from "@guitar/db"
import { updateUserMetadataZod, z } from "@guitar/schemas"

export default async function updateUserMetadata(
  input: z.infer<typeof updateUserMetadataZod>,
  userId: string,
) {
  const { defaultTuning } = input

  const existingMetadata = await db.query.usersMetadataTable.findFirst({
    where: eq(usersMetadataTable.userId, userId),
  })

  if (existingMetadata) {
    const update: { defaultTuning?: GuitarTuning } = {}
    if (defaultTuning !== undefined) update.defaultTuning = defaultTuning

    await db.update(usersMetadataTable).set(update).where(eq(usersMetadataTable.userId, userId))
  } else {
    await db.insert(usersMetadataTable).values({
      userId,
      defaultTuning: defaultTuning ?? [0, 0, 0, 0, 0, 0],
    })
  }

  const metadata = await db.query.usersMetadataTable.findFirst({
    where: eq(usersMetadataTable.userId, userId),
  })

  return metadata ?? null
}
