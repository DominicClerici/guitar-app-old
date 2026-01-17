import TunerGraph from "@/components/tuner/tuner-graph"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

export default function page() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Tuner</h1>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Back
        </Link>
      </div>
      <TunerGraph />
    </div>
  )
}
