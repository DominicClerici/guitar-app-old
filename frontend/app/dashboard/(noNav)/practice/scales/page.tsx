import ScalesPracticeClient from "@/components/scales/scales-practice-client"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

export default function page() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 py-4">
      <div className="flex items-center gap-4">
        <h2>Practice your scales</h2>
        <Link href="/dashboard/practice" className={buttonVariants({ variant: "outline" })}>
          Back
        </Link>
      </div>
      <ScalesPracticeClient />
    </div>
  )
}
