import { db, eq, usersTable } from "@guitar/db"

export default async function getUserInfo(userId: string) {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
    with: { profile: true, metadata: true },
  })
  return user ?? null
}
