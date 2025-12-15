import LoginForm from "@/components/custom/auth/login-form"
import Link from "next/link"

export default function page() {
  return (
    <div className="mx-auto max-w-md pt-24">
      <LoginForm />
      <Link href="/sign-up">Sign up</Link>
      <Link href="/forgot-password">Forgot password</Link>
    </div>
  )
}
