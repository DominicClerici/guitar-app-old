import { db, eq, usersMetadataTable } from "@guitar/db"

export default async function getUserMetadata(userId: string) {
  const metadata = await db.query.usersMetadataTable.findFirst({
    where: eq(usersMetadataTable.userId, userId),
  })
  return metadata ?? null
}
