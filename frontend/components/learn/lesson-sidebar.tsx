"use client"

import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import type { LessonConfig, ModuleType } from "@/lib/caged-practice/module-config"
import { cn } from "@/lib/utils"
import { BookOpen, CheckCircle2, Circle, Eye, HelpCircle, Play } from "lucide-react"

interface LessonSidebarProps {
  lessonConfig: LessonConfig
  completedModuleIds: Set<string>
  currentModuleId: string | null
  activeModuleId: string | null
  onSelectModule: (moduleId: string) => void
  isLoading: boolean
}

const MODULE_TYPE_ICONS: Record<ModuleType, React.ComponentType<{ className?: string }>> = {
  article: BookOpen,
  practice: Play,
  quiz: HelpCircle,
  test: Eye,
}

const MODULE_TYPE_LABELS: Record<ModuleType, string> = {
  article: "Article",
  practice: "Practice",
  quiz: "Quiz",
  test: "Test",
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="size-4 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export default function LessonSidebar({
  lessonConfig,
  completedModuleIds,
  currentModuleId,
  activeModuleId,
  onSelectModule,
  isLoading,
}: LessonSidebarProps) {
  const completedCount = lessonConfig.modules.filter((m) => completedModuleIds.has(m.id)).length
  const totalCount = lessonConfig.modules.length
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <aside className="bg-card/50 sticky top-20 h-fit w-full max-w-64 shrink-0 grow flex-col overflow-hidden rounded-2xl border backdrop-blur-sm lg:flex xl:max-w-72 2xl:max-w-82">
      <div className="flex flex-col gap-3 p-4 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold tracking-tight">{lessonConfig.label}</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {completedCount}/{totalCount}
          </span>
        </div>

        <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <Separator />

      {isLoading ? (
        <SidebarSkeleton />
      ) : (
        <div className="scrollbar-hide flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {lessonConfig.modules.map((module) => {
            const Icon = MODULE_TYPE_ICONS[module.type]
            const typeLabel = MODULE_TYPE_LABELS[module.type]
            const isCompleted = completedModuleIds.has(module.id)
            const isCurrent = module.id === currentModuleId
            const isActive = module.id === activeModuleId

            return (
              <button
                key={module.id}
                onClick={() => onSelectModule(module.id)}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-150",
                  isActive ? "bg-muted" : isCurrent ? "bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : isCurrent
                        ? "bg-primary/10 text-primary"
                        : isCompleted
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "truncate text-[13px] leading-tight font-medium",
                      isActive || isCurrent
                        ? "text-foreground"
                        : isCompleted
                          ? "text-foreground/80"
                          : "text-muted-foreground group-hover:text-foreground/80",
                    )}
                  >
                    {module.label}
                  </span>
                  <span className="text-muted-foreground/70 text-[10px] leading-tight">
                    {typeLabel}
                  </span>
                </div>

                <div className="shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="text-primary size-4" />
                  ) : (
                    <Circle
                      className={cn(
                        "size-4 transition-colors",
                        isCurrent ? "text-primary/40" : "text-muted-foreground/30",
                      )}
                    />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </aside>
  )
}
