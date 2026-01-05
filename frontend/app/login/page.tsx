import LoginForm from "@/components/auth/login-form"
import Link from "next/link"

export default function page() {
  return (
    <div className="mx-auto flex h-screen max-w-xl flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Login</h1>
      <LoginForm />
      <div className="bg-muted-foreground h-px w-full" />
      <Link href="/sign-up">Sign up</Link>
    </div>
  )
}
