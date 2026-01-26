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
  .max(128, { message: "Password must not exceed 128 characters" })
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

export const registerBackendZod = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  email: z.email().min(1, "Email is required").max(255, "Email must not exceed 255 characters"),
  password: passwordZod,
})

export const resetPasswordFormZod = z
  .object({
    password: passwordZod,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export const changeEmailZod = z.object({
  email: z
    .email("Please enter a valid email address")
    .max(255, "Email must not exceed 255 characters"),
})

export const requestPasswordResetZod = z.object({
  redirectUrl: z.string().url(),
})

export const requestEmailChangeZod = z.object({
  newEmail: z
    .email("Please enter a valid email address")
    .max(255, "Email must not exceed 255 characters"),
  redirectUrl: z.string().url(),
})
