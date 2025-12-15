"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UserInfo } from "@/lib/fetches/getUserInfo"
import registerUser from "@/lib/mutations/registerUser"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import { toast } from "sonner"

export default function AuthClient({ user }: { user: UserInfo | null }) {
  const supabase = createClient()
  const [values, setValues] = useState({
    email: "",
    password: "",
    fullName: "Dominic",
  })

  if (!user) {
    const handleLogin = async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })
      if (error) {
        console.error(error)
      }
      if (data || !error) {
        window.location.reload()
      }
    }

    const handleRegister = async () => {
      const { error } = await registerUser(values)
      if (error) {
        console.error(error)
      } else {
        toast.success("Registration successful.")
      }
    }

    return (
      <div className="flex items-center gap-2">
        Not logged in
        <Input
          className="w-64"
          type="email"
          placeholder="Email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
        />
        <Input
          className="w-64"
          type="password"
          placeholder="Password"
          value={values.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
        />
        <Button onClick={handleLogin}>Login</Button>
        <Button onClick={handleRegister}>Register</Button>
      </div>
    )
  }
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error(error)
    }
    window.location.reload()
  }
  return (
    <div className="flex items-center gap-2">
      Logged in as {user.email}
      <Button onClick={handleLogout}>Logout</Button>
    </div>
  )
}
