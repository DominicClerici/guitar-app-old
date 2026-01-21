import Link from "next/link"

export default function Logo({ href }: { href?: string }) {
  const content = (
    <>
      <div className="flex items-center">
        {[...Array(6)].map((_, i) => (
          <div key={`logo-string-${i}`} className="group/logo flex grow items-center px-0.5">
            <div
              className="bg-foreground group-hover/logo:bg-primary-hover h-6 transition-colors duration-200"
              style={{
                width: `${1 + i * 0.5}px`,
              }}
            />
          </div>
        ))}
      </div>
      <span className="text-xl font-semibold tracking-tight">StringFlow</span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className="flex items-center gap-2">
        {content}
      </Link>
    )
  }

  return <div className="flex items-center gap-2">{content}</div>
}
