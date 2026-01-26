import { Resend } from "resend"

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY environment variable")
  }
  return new Resend(apiKey)
}

const FROM_EMAIL = "StringFlow <noreply@gostringflow.com>"

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  const resend = getResendClient()

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Reset your StringFlow password",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; margin-bottom: 24px;">Reset Your Password</h1>
          <p style="color: #555; font-size: 16px; line-height: 1.5;">
            You requested to reset your password for your StringFlow account.
          </p>
          <p style="color: #555; font-size: 16px; line-height: 1.5;">
            Click the button below to set a new password:
          </p>
          <a href="${resetLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 24px 0; font-weight: 500;">
            Reset Password
          </a>
          <p style="color: #888; font-size: 14px; margin-top: 32px;">
            If you didn't request this, you can safely ignore this email. This link will expire in 1 hour.
          </p>
          <p style="color: #888; font-size: 14px;">
            - The StringFlow Team
          </p>
        </body>
      </html>
    `,
  })

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`)
  }
}

export async function sendEmailChangeConfirmation(
  currentEmail: string,
  newEmail: string,
  confirmationLink: string,
) {
  const resend = getResendClient()

  const { error: currentEmailError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: currentEmail,
    subject: "Confirm your email change on StringFlow",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Email Change Requested</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; margin-bottom: 24px;">Email Change Requested</h1>
          <p style="color: #555; font-size: 16px; line-height: 1.5;">
            A request was made to change your StringFlow account email from <strong>${currentEmail}</strong> to <strong>${newEmail}</strong>.
          </p>
          <p style="color: #555; font-size: 16px; line-height: 1.5;">
            If you made this request, click the button below to confirm:
          </p>
          <a href="${confirmationLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 24px 0; font-weight: 500;">
            Confirm Email Change
          </a>
          <p style="color: #888; font-size: 14px; margin-top: 32px;">
            If you didn't request this change, please secure your account by changing your password immediately.
          </p>
          <p style="color: #888; font-size: 14px;">
            - The StringFlow Team
          </p>
        </body>
      </html>
    `,
  })

  if (currentEmailError) {
    throw new Error(`Failed to send confirmation to current email: ${currentEmailError.message}`)
  }

  const { error: newEmailError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: newEmail,
    subject: "Verify your new email for StringFlow",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your New Email</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; margin-bottom: 24px;">Verify Your New Email</h1>
          <p style="color: #555; font-size: 16px; line-height: 1.5;">
            You requested to use this email address for your StringFlow account.
          </p>
          <p style="color: #555; font-size: 16px; line-height: 1.5;">
            Click the button below to verify this email:
          </p>
          <a href="${confirmationLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 24px 0; font-weight: 500;">
            Verify Email
          </a>
          <p style="color: #888; font-size: 14px; margin-top: 32px;">
            If you didn't request this, you can safely ignore this email.
          </p>
          <p style="color: #888; font-size: 14px;">
            - The StringFlow Team
          </p>
        </body>
      </html>
    `,
  })

  if (newEmailError) {
    throw new Error(`Failed to send verification to new email: ${newEmailError.message}`)
  }
}
