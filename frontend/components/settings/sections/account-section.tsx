"use client"

import { Card, CardContent } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"

export default function AccountSection() {
  const { user } = useAuth()

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email</span>
          <span className="text-muted-foreground text-sm">{user?.email ?? "Loading..."}</span>
        </div>
      </CardContent>
    </Card>
  )
}
