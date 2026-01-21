import { db, eq, userProfileTable, usersTable, type DatabaseImage } from "@guitar/db"
import { updateUserProfileZod, z } from "@guitar/schemas"
import type { SupabaseClient } from "@supabase/supabase-js"

export default async function updateProfile(
  input: z.infer<typeof updateUserProfileZod>,
  userId: string,
  supabase: SupabaseClient,
) {
  const { name, country, bio, profilePicture } = input

  if (name) {
    await db.update(usersTable).set({ name }).where(eq(usersTable.id, userId))
  }

  if (country !== undefined || bio !== undefined || profilePicture !== undefined) {
    // If uploading a new profile picture or deleting, remove the old one first
    if (profilePicture !== undefined) {
      const existingProfile = await db.query.userProfileTable.findFirst({
        where: eq(userProfileTable.userId, userId),
        columns: { profilePicture: true },
      })

      if (existingProfile?.profilePicture?.path) {
        await supabase.storage.from("profile-pictures").remove([existingProfile.profilePicture.path])
      }
    }

    const profileUpdate: {
      country?: string
      bio?: string
      profilePicture?: DatabaseImage | null
    } = {}
    if (country !== undefined) profileUpdate.country = country
    if (bio !== undefined) profileUpdate.bio = bio
    if (profilePicture !== undefined) profileUpdate.profilePicture = profilePicture

    await db.update(userProfileTable).set(profileUpdate).where(eq(userProfileTable.userId, userId))
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
    with: { profile: true },
  })

  return user ?? null
}
