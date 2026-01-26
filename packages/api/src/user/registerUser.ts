import { db, userProfileTable, usersMetadataTable } from "@guitar/db"
import { registerBackendZod, z } from "@guitar/schemas"
import { SupabaseClient } from "@supabase/supabase-js"

export default async function registerUser(
  input: z.infer<typeof registerBackendZod>,
  _supabase: SupabaseClient,
) {
  await Promise.all([
    db.insert(userProfileTable).values({
      userId: input.id,
      country: null,
      bio: null,
    }),
    db.insert(usersMetadataTable).values({
      userId: input.id,
      defaultTuning: [0, 0, 0, 0, 0, 0],
    }),
  ])

  return { error: null }
}
