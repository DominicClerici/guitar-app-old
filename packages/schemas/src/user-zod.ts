import { z } from "zod"

export const updateUserProfileZod = z.object({
  name: z.string().min(1).max(100).optional(),
  country: z.string().optional(),
  bio: z.string().min(1).max(1000).optional(),
  profilePicture: z
    .object({
      path: z.string(),
      url: z.string(),
    })
    .nullable()
    .optional(),
})
