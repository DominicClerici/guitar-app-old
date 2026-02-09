import LearnModuleClient from "@/components/learn/learn-module-client"
import HoverArrow from "@/components/ui/hover-arrow/hover-arrow"
import Link from "next/link"

type PageProps = {
  params: Promise<{ module: string }>
}

export default async function LearnModulePage({ params }: PageProps) {
  const { module } = await params

  return (
    <div className="flex flex-col px-4 pb-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center">
        <Link
          href="/dashboard/learn"
          className="text-muted-foreground hover:text-foreground group -ml-2 inline-flex items-center gap-2 px-2 py-2 text-sm transition-colors"
        >
          <HoverArrow className="size-4 rotate-180" />
          Back to Learn
        </Link>
      </div>
      <LearnModuleClient module={module} />
    </div>
  )
}
