"use client"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"

export default function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const handleLogout = async () => {
    setIsLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    setIsLoggingOut(false)
  }
  return (
    <Button onClick={handleLogout} isLoading={isLoggingOut}>
      Logout
    </Button>
  )
}
