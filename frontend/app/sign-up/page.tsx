import SignupForm from "@/components/auth/signup-form"
import Link from "next/link"

export default function page() {
  return (
    <div className="mx-auto flex h-screen max-w-xl flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Sign up</h1>
      <SignupForm />
      <div className="bg-muted-foreground h-px w-full" />
      <Link href="/login">Login</Link>
    </div>
  )
}
