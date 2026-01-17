"use client"

import useAuth from "@/hooks/useAuth"
import { Loader2, LogOutIcon } from "lucide-react"
import Link from "next/link"
import { Button } from "../button"
import { Separator } from "../separator"

export default function DesktopNav() {
  const { user, logout, isLoading } = useAuth()

  return (
    <header className="bg-background-elevated fixed top-0 left-0 z-50 flex h-full w-72 flex-col border-r">
      <div className="mt-2 flex items-center justify-between px-4">
        <Link href="/">Logo</Link>
      </div>
      <Separator className="my-2" />
      <div className="flex flex-col gap-2 px-4">
        <Link href="/dashboard">Home</Link>
        <Link href="/dashboard/practice">Practice</Link>
        <Link href="/dashboard/tabs">Tabs</Link>
        <Link href="/dashboard/stats">My Stats</Link>
        <Link href="/dashboard/tuner">Tuner</Link>
        <Link href="/dashboard/settings">Settings</Link>
      </div>

      <div className="mt-auto flex flex-col gap-2 px-4 pb-4">
        <div className="flex items-center justify-between rounded-md border px-2 py-1">
          {isLoading || !user ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex flex-col">
                <p className="text-sm font-medium">{user?.user_metadata.name}</p>
                <p className="text-muted-foreground text-xs">{user?.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={logout}>
                <LogOutIcon className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
