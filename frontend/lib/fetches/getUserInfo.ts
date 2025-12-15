import { db, eq, usersTable } from "@guitar/db"
import { createClient } from "../supabase/server"

export type SupabaseMetadata = {
  email: string
  email_verified: boolean
  name: string
  phone_verified: boolean
  sub: string
}

export default async function getUserInfo() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      return null
    }
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, data.user.id),
    })
    if (!user) {
      console.error("User not found but is logged in")
      return null
    }
    const withMetadata = {
      ...user,
      supabaseMetadata: data.user.user_metadata as SupabaseMetadata,
    }
    return withMetadata
  } catch (error) {
    console.error(error)
    return null
  }
}

export type UserInfo = NonNullable<Awaited<ReturnType<typeof getUserInfo>>>
