import { db, eq, usersTable } from "@guitar/db"

export default async function getUserInfo(userId: string) {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  })
  return user ?? null
}
