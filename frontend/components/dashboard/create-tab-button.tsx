"use client"

import createTab from "@/lib/mutations/createTab"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "../ui/button"

export default function CreateTabButton() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const handleCreateTab = async () => {
    setIsLoading(true)
    const { data, error } = await createTab()
    if (error || !data) {
      console.error(error)
      return
    }
    router.push(`/dashboard/tab/${data}`)
    setIsLoading(false)
  }
  return (
    <Button variant="outline" className="w-fit" onClick={handleCreateTab} isLoading={isLoading}>
      Create new tab
    </Button>
  )
}
