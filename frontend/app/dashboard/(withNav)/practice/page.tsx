import Link from "next/link"

export default function page() {
  return (
    <div className="flex flex-col gap-4">
      <h2>Practice your scales</h2>
      <div className="grid grid-cols-4 gap-4">
        <Link href="/dashboard/practice/scales" className="rounded-md border p-2">
          Major Scale
        </Link>
        <Link href="/dashboard/practice/scales" className="rounded-md border p-2">
          Minor Scale
        </Link>
        <Link href="/dashboard/practice/scales" className="rounded-md border p-2">
          Major Pentatonic Scale
        </Link>
        <Link href="/dashboard/practice/scales" className="rounded-md border p-2">
          Minor Pentatonic Scale
        </Link>
      </div>
      <h2>Practice your arpeggios</h2>
      <div className="grid grid-cols-4 gap-4">
        <Link href="/dashboard/practice/scales" className="rounded-md border p-2">
          Major Scale
        </Link>
        <Link href="/dashboard/practice/scales" className="rounded-md border p-2">
          Minor Scale
        </Link>
        <Link href="/dashboard/practice/scales" className="rounded-md border p-2">
          Major Pentatonic Scale
        </Link>
        <Link href="/dashboard/practice/scales" className="rounded-md border p-2">
          Minor Pentatonic Scale
        </Link>
      </div>
    </div>
  )
}
