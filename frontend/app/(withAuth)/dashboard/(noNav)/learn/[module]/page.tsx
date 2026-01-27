import LearnModuleClient from "@/components/learn/learn-module-client"
import HoverArrow from "@/components/ui/hover-arrow/hover-arrow"
import Link from "next/link"

type PageProps = {
  params: Promise<{ module: string }>
}

export default async function LearnModulePage({ params }: PageProps) {
  const { module } = await params

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/learn"
        className="text-muted-foreground hover:text-foreground group inline-flex items-center gap-2 text-sm transition-colors"
      >
        <HoverArrow className="size-4 rotate-180" />
        Back to Learn
      </Link>
      <LearnModuleClient module={module} />
    </div>
  )
}
