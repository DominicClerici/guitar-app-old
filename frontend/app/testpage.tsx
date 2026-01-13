"use client"

import useAuth from "@/hooks/useAuth"

export default function TestPage() {
  const { user, isLoading } = useAuth()
  return (
    <>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <p>Username: {user ? "Logged in" : "No email/not logged in"}</p>
      )}
    </>
  )
}
