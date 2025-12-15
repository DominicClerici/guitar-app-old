import { db, eq, usersTable } from "@guitar/db"
import { createClient } from "../supabase/server"

export type SupabaseMetadata = {
  email: string
  email_verified: boolean
  name: string
  phone_verified: boolean
  sub: string
}

type UsersRelations = NonNullable<
  NonNullable<Parameters<typeof db.query.usersTable.findFirst>[0]>["with"]
>

type UserQueryResult<T extends UsersRelations | undefined> = NonNullable<
  Awaited<ReturnType<typeof db.query.usersTable.findFirst<{ with: T }>>>
>

type UserWithMetadata<T extends UsersRelations | undefined> = UserQueryResult<T> & {
  supabaseMetadata: SupabaseMetadata
}

export default async function getUserInfo<T extends UsersRelations | undefined = undefined>(
  withRelations?: T,
): Promise<UserWithMetadata<T> | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      return null
    }
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, data.user.id),
      with: withRelations,
    })
    if (!user) {
      console.error("User not found but is logged in")
      return null
    }
    const withMetadata = {
      ...user,
      supabaseMetadata: data.user.user_metadata as SupabaseMetadata,
    }
    return withMetadata as UserWithMetadata<T>
  } catch (error) {
    console.error(error)
    return null
  }
}

export type UserInfo<T extends UsersRelations | undefined = undefined> = UserWithMetadata<T>
