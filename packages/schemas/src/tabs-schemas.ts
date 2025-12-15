import { z } from "zod"

export const tabInformationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  description: z.string().max(1000, "Description must not exceed 1000 characters").optional(),
})
