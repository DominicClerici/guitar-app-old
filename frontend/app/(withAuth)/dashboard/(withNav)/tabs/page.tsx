import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

export default function page() {
  return (
    <div className="flex flex-col gap-4">
      <h2>Tabs</h2>
      <div className="grid grid-cols-4 gap-4">
        <Link href="/dashboard/tabs/edit" className={buttonVariants({ variant: "outline" })}>
          Edit
        </Link>
      </div>
    </div>
  )
}
