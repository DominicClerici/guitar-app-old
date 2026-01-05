import { z } from "zod"

export const loginZod = z.object({
  email: z.email().min(1, "Email is required").max(255, "Email must not exceed 255 characters"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password must not exceed 128 characters"),
})

export const passwordZod = z
  .string()
  .min(8, { message: "Password must be at least 8 characters long" })
  .max(128, { message: "Password must not exceed 64 characters" })
  .refine((password) => /[A-Z]/.test(password), {
    message: "Password must contain at least one uppercase letter",
  })
  .refine((password) => /[0-9]/.test(password), {
    message: "Password must contain at least one number",
  })
  .refine((password) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(password), {
    message: "Password must contain at least one special character",
  })

export const signUpZod = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  email: z.email().min(1, "Email is required").max(255, "Email must not exceed 255 characters"),
  password: passwordZod,
})
