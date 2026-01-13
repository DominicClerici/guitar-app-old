"use client"

import { GoogleIcon } from "@/components/icons/google"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import useAuth from "@/hooks/useAuth"
import { loginZod } from "@guitar/schemas"
import { useForm } from "@tanstack/react-form"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function LoginForm() {
  const router = useRouter()
  const { signInWithGoogle, supabase } = useAuth()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      toast.error(error)
      setIsGoogleLoading(false)
    }
  }

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: loginZod,
    },
    onSubmit: async ({ value }) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: value.email,
        password: value.password,
      })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success("Login successful")
        router.push("/")
      }
    },
  })

  return (
    <>
      <form
        id="login-form"
        className="w-full"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.Field
            name="email"
            children={(field) => {
              const isInvalid = !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="email@example.com"
                    autoComplete="off"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          />
          <form.Field
            name="password"
            children={(field) => {
              const isInvalid = !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="********"
                    autoComplete="off"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          />
        </FieldGroup>
      </form>
      <Button type="submit" form="login-form">
        Login
      </Button>

      <div className="flex items-center gap-4 my-4">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-sm">or</span>
        <Separator className="flex-1" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>
    </>
  )
}
