import Link from "next/link"

export default function HomeHeader() {
  return (
    <>
      <header className="hidden w-full items-center justify-between border-b px-12 py-4 md:flex">
        <div>
          <Link href="/">Logo</Link>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </header>
      <header className="flex items-center justify-between md:hidden">
        <div>
          <Link href="/">Logo</Link>
        </div>
      </header>
    </>
  )
}
