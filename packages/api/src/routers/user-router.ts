import {
  registerBackendZod,
  requestEmailChangeZod,
  requestPasswordResetZod,
  updateUserMetadataZod,
  updateUserProfileZod,
} from "@guitar/schemas"
import { TRPCError } from "@trpc/server"
import { sendEmailChangeConfirmation, sendPasswordResetEmail } from "../lib/email"
import { getSupabaseAdmin } from "../lib/supabase-admin"
import { protectedProcedure, publicProcedure, router } from "../trpc"
import getUserInfo from "../user/getUserInfo"
import getUserMetadata from "../user/getUserMetadata"
import registerUser from "../user/registerUser"
import updateProfile from "../user/updateProfile"
import updateUserMetadata from "../user/updateUserMetadata"

export const userRouter = router({
  // Get the current authenticated user's profile
  getUserInfo: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id ?? null
    if (!userId) {
      console.error("No user ID found")
      return null
    }
    return await getUserInfo(userId)
  }),
  registerUser: publicProcedure.input(registerBackendZod).mutation(async ({ ctx, input }) => {
    if (ctx.user?.id !== input.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not authorized to register this user",
      })
    }

    return await registerUser(input, ctx.supabase)
  }),
  updateUserProfile: protectedProcedure
    .input(updateUserProfileZod)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to update your profile",
        })
      }
      return await updateProfile(input, ctx.user.id, ctx.supabase)
    }),
  getUserMetadata: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id ?? null
    if (!userId) {
      return null
    }
    return await getUserMetadata(userId)
  }),
  updateUserMetadata: protectedProcedure
    .input(updateUserMetadataZod)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to update your metadata",
        })
      }
      return await updateUserMetadata(input, ctx.user.id)
    }),
  requestPasswordReset: protectedProcedure
    .input(requestPasswordResetZod)
    .mutation(async ({ ctx, input }) => {
      const email = ctx.user.email
      if (!email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No email associated with this account",
        })
      }

      const supabaseAdmin = getSupabaseAdmin()
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: input.redirectUrl,
        },
      })

      if (error || !data.properties?.action_link) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Failed to generate password reset link",
        })
      }

      await sendPasswordResetEmail(email, data.properties.action_link)
      return { success: true }
    }),
  requestEmailChange: protectedProcedure
    .input(requestEmailChangeZod)
    .mutation(async ({ ctx, input }) => {
      const currentEmail = ctx.user.email
      if (!currentEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No email associated with this account",
        })
      }

      if (input.newEmail.toLowerCase() === currentEmail.toLowerCase()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "New email must be different from your current email",
        })
      }

      const supabaseAdmin = getSupabaseAdmin()

      // Check if the new email is already in use
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const emailInUse = existingUsers?.users?.some(
        (u) => u.email?.toLowerCase() === input.newEmail.toLowerCase(),
      )
      if (emailInUse) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email is already in use by another account",
        })
      }

      // Generate email change link
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "email_change_new",
        email: currentEmail,
        newEmail: input.newEmail,
        options: {
          redirectTo: input.redirectUrl,
        },
      })

      if (error || !data.properties?.action_link) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Failed to generate email change link",
        })
      }

      await sendEmailChangeConfirmation(currentEmail, input.newEmail, data.properties.action_link)
      return { success: true }
    }),
})
