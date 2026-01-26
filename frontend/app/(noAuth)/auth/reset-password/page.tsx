"use client"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import HoverArrow from "@/components/ui/hover-arrow/hover-arrow"
import { PasswordInput } from "@/components/ui/password-input"
import { createClient } from "@/lib/supabase/client"
import { resetPasswordFormZod } from "@guitar/schemas"
import { useForm } from "@tanstack/react-form"
import { KeyRound, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

function GuitarStrings() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="bg-foreground absolute right-0 left-0 h-px"
          style={{
            top: `${15 + i * 14}%`,
            transform: `rotate(${1.5 - i * 0.4}deg)`,
          }}
        />
      ))}
    </div>
  )
}

function FloatingKey({ className, delay }: { className: string; delay: number }) {
  return (
    <div
      className={`animate-float-up absolute opacity-0 ${className}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <KeyRound className="text-primary/25 size-5" />
    </div>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setIsValidSession(!!session)
    }
    checkSession()
  }, [supabase])

  const form = useForm({
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: resetPasswordFormZod,
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true)

      try {
        const { error } = await supabase.auth.updateUser({
          password: value.password,
        })

        if (error) {
          throw error
        }

        toast.success("Password updated successfully!")
        router.push("/login")
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes("session") || error.message.includes("expired")) {
            setIsValidSession(false)
            toast.error("Your session has expired. Please request a new password reset link.")
          } else {
            toast.error(error.message)
          }
        } else {
          toast.error("Failed to update password")
        }
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  if (isValidSession === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="bg-primary/10 size-12 animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!isValidSession) {
    return (
      <div className="relative flex min-h-screen">
        <GuitarStrings />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--primary)_0%,transparent_50%)] opacity-[0.06]" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
          <div
            className="animate-float-up w-full max-w-md text-center opacity-0"
            style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
          >
            <div className="bg-card/60 rounded-2xl border p-8 shadow-xl backdrop-blur-sm">
              <div className="bg-destructive/10 border-destructive/20 mx-auto mb-6 flex size-12 items-center justify-center rounded-xl border">
                <ShieldCheck className="text-destructive size-6" />
              </div>
              <h1 className="font-display mb-2 text-xl font-bold">Invalid or Expired Link</h1>
              <p className="text-muted-foreground mb-6 text-sm">
                This password reset link is invalid or has expired. Please request a new one from
                your account settings.
              </p>
              <Button href="/login" className="w-full">
                Back to Login
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen">
      <GuitarStrings />

      <FloatingKey className="top-[18%] right-[12%]" delay={700} />
      <FloatingKey className="top-[32%] left-[10%]" delay={1100} />
      <FloatingKey className="right-[18%] bottom-[28%]" delay={1500} />
      <FloatingKey className="bottom-[18%] left-[14%]" delay={1900} />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--primary)_0%,transparent_50%)] opacity-[0.06]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,var(--primary)_0%,transparent_40%)] opacity-[0.04]" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div
          className="animate-float-up w-full max-w-md opacity-0"
          style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
        >
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground group mb-8 inline-flex items-center gap-2 text-sm transition-colors"
          >
            <HoverArrow className="size-3 rotate-180" />
            Back to login
          </Link>

          <div className="bg-card/60 rounded-2xl border p-8 shadow-xl backdrop-blur-sm">
            <div className="mb-8 text-center">
              <div
                className="bg-primary/10 border-primary/20 mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border"
                style={{ animationDelay: "200ms" }}
              >
                <KeyRound className="text-primary size-6" />
              </div>

              <h1
                className="animate-float-up font-display text-2xl font-bold tracking-tight opacity-0"
                style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
              >
                Reset Your Password
              </h1>

              <p
                className="text-muted-foreground animate-float-up mt-2 text-sm opacity-0"
                style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
              >
                Choose a strong password to secure your account
              </p>
            </div>

            <div
              className="animate-float-up opacity-0"
              style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
            >
              <form
                id="reset-password-form"
                className="w-full"
                onSubmit={(e) => {
                  e.preventDefault()
                  form.handleSubmit()
                }}
              >
                <FieldGroup>
                  <form.Field
                    name="password"
                    children={(field) => {
                      const errors = field.state.meta.errors
                      const isInvalid = errors.length > 0 && field.state.meta.isTouched
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>New Password</FieldLabel>
                          <PasswordInput
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                            placeholder="Enter your new password"
                            autoComplete="new-password"
                          />
                          <FieldDescription>
                            At least 8 characters with uppercase, lowercase, number, and special
                            character
                          </FieldDescription>
                          {isInvalid && <FieldError errors={errors} />}
                        </Field>
                      )
                    }}
                  />

                  <form.Field
                    name="confirmPassword"
                    children={(field) => {
                      const errors = field.state.meta.errors
                      const isInvalid = errors.length > 0 && field.state.meta.isTouched
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Confirm Password</FieldLabel>
                          <PasswordInput
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                            placeholder="Confirm your new password"
                            autoComplete="new-password"
                          />
                          {isInvalid && <FieldError errors={errors} />}
                        </Field>
                      )
                    }}
                  />
                </FieldGroup>
              </form>

              <Button
                type="submit"
                form="reset-password-form"
                className="mt-6 w-full"
                isLoading={isSubmitting}
              >
                Reset Password
              </Button>
            </div>
          </div>

          <p
            className="text-muted-foreground animate-float-up mt-6 text-center text-sm opacity-0"
            style={{ animationDelay: "500ms", animationFillMode: "forwards" }}
          >
            Remember your password?{" "}
            <Link
              href="/login"
              className="text-primary hover:text-primary-hover font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="bg-card/30 relative hidden w-1/2 overflow-hidden border-l lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_60%)] opacity-[0.08]" />

        <div className="relative flex h-full flex-col items-center justify-center p-12">
          <div
            className="animate-scale-in max-w-md text-center opacity-0"
            style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
          >
            <div className="bg-primary/10 border-primary/20 mx-auto mb-8 flex size-16 items-center justify-center rounded-2xl border">
              <ShieldCheck className="text-primary size-8" />
            </div>

            <h2 className="font-display text-3xl font-bold tracking-tight">
              Secure your <span className="text-primary">account</span>
            </h2>

            <p className="text-muted-foreground mt-4 leading-relaxed">
              A strong password helps protect your learning progress, achievements, and personal
              information on StringFlow.
            </p>

            <div className="bg-card/50 mt-8 rounded-xl border p-6 text-left">
              <h3 className="mb-4 text-sm font-medium">Password tips:</h3>
              <ul className="text-muted-foreground space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <div className="bg-primary/20 mt-1 size-1.5 shrink-0 rounded-full" />
                  <span>Use at least 8 characters</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-primary/20 mt-1 size-1.5 shrink-0 rounded-full" />
                  <span>Mix uppercase and lowercase letters</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-primary/20 mt-1 size-1.5 shrink-0 rounded-full" />
                  <span>Include at least one number</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-primary/20 mt-1 size-1.5 shrink-0 rounded-full" />
                  <span>Include a special character (!@#$%^&*)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
