"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BookOpen, Eye, Zap } from "lucide-react"

interface PracticeModeInfo {
  phase: string
  currentShape?: string
  keysCompleted?: number
  totalKeys?: number
}

interface LearnHeaderProps {
  title: string
  subtitle: string
  gradient: string
  keyName: string
  viewMode: "article" | "preview" | "practice"
  onToggleView: () => void
  className?: string
  practiceInfo?: PracticeModeInfo
}

export default function LearnHeader({
  title,
  subtitle,
  gradient,
  keyName,
  viewMode,
  onToggleView,
  className,
  practiceInfo,
}: LearnHeaderProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-90",
          gradient || "from-emerald-500 via-teal-600 to-cyan-700",
        )}
      />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />

      <div className="absolute inset-0 opacity-30">
        <svg className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <pattern id="learn-grid" patternUnits="userSpaceOnUse" width="40" height="40">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-white/20"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#learn-grid)" />
        </svg>
      </div>

      <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold tracking-[0.2em] text-white/60 uppercase">
              {subtitle}
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === "practice" && practiceInfo ? (
              <Badge className="gap-1.5 border-white/30 bg-white/20 text-white backdrop-blur-sm">
                <Zap className="size-3" />
                {practiceInfo.phase}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-white/30 bg-white/10 text-white backdrop-blur-sm"
              >
                <BookOpen className="mr-1 size-3" />
                Learning Module
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <span className="font-display text-lg font-bold text-white">{keyName}</span>
            </div>
            <div>
              <p className="text-[10px] font-medium tracking-wider text-white/50 uppercase">Key</p>
              <p className="text-sm font-semibold text-white">{keyName} Major</p>
            </div>
          </div>

          {viewMode !== "practice" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleView}
              className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
            >
              {viewMode === "article" ? (
                <>
                  <Eye className="mr-1.5 size-4" />
                  Preview Fretboard
                </>
              ) : (
                <>
                  <BookOpen className="mr-1.5 size-4" />
                  Back to Article
                </>
              )}
            </Button>
          )}
          {viewMode === "practice" && practiceInfo && (
            <div className="flex items-center gap-3">
              {practiceInfo.currentShape && (
                <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                  <span className="text-xs font-medium text-white/70">Shape</span>
                  <span className="font-display text-lg font-bold text-white">
                    {practiceInfo.currentShape}
                  </span>
                </div>
              )}
              {practiceInfo.keysCompleted !== undefined && practiceInfo.totalKeys !== undefined && (
                <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                  <span className="text-xs font-medium text-white/70">Keys</span>
                  <span className="font-display text-lg font-bold text-white tabular-nums">
                    {practiceInfo.keysCompleted + 1}/{practiceInfo.totalKeys}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
