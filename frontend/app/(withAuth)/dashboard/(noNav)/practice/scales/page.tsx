import ScalesPracticeClient from "@/components/scales/scales-practice-client"
import HoverArrow from "@/components/ui/hover-arrow/hover-arrow"
import { SessionTrackingProvider } from "@/hooks/useSessionTracking"
import Link from "next/link"

export default function page() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/practice"
        className="text-muted-foreground hover:text-foreground group inline-flex items-center gap-2 text-sm transition-colors"
      >
        <HoverArrow className="size-4 rotate-180" />
        Back to Dashboard
      </Link>
      <SessionTrackingProvider>
        <ScalesPracticeClient />
      </SessionTrackingProvider>
    </div>
  )
}
