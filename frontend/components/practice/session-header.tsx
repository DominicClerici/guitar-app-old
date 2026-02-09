"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Clock, Dices, Eye, EyeOff, Hash, Infinity, Music } from "lucide-react"

export type SessionConfig = {
  sessionType: "infinite" | "timed" | "shapes"
  duration: { minutes: number; seconds: number } | null
  targetShapes: number | null
  key: string
  shapes: number[]
  startedAt: number
  formulaType: "scale" | "arpeggio" | "caged"
  formulaId: string
  scaleName?: string
  gradient?: string
  noteVisibility?: "all" | "roots" | "hidden"
}

interface SessionHeaderProps {
  config: SessionConfig
  className?: string
  hideShapes?: boolean
}

const SESSION_TYPE_INFO = {
  infinite: { label: "Infinite", icon: Infinity },
  timed: { label: "Timed", icon: Clock },
  shapes: { label: "Shape Count", icon: Hash },
}

export default function SessionHeader({ config, className, hideShapes }: SessionHeaderProps) {
  const typeInfo = SESSION_TYPE_INFO[config.sessionType]
  const TypeIcon = typeInfo.icon

  const formatDuration = (duration: { minutes: number; seconds: number }) => {
    if (duration.seconds === 0) return `${duration.minutes}m`
    return `${duration.minutes}m ${duration.seconds}s`
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-90",
          config.gradient || "from-violet-600 via-purple-600 to-indigo-700",
        )}
      />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />

      <div className="absolute inset-0 opacity-30">
        <svg className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <pattern id="session-grid" patternUnits="userSpaceOnUse" width="40" height="40">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-white/20"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#session-grid)" />
        </svg>
      </div>

      <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold tracking-[0.2em] text-white/60 uppercase">
              Practice Session
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {config.scaleName || "Major Scale"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-white/30 bg-white/10 text-white backdrop-blur-sm"
            >
              <TypeIcon className="mr-1 size-3" />
              {typeInfo.label}
              {config.sessionType === "timed" && config.duration && (
                <span className="ml-1 opacity-80">· {formatDuration(config.duration)}</span>
              )}
              {config.sessionType === "shapes" && config.targetShapes && (
                <span className="ml-1 opacity-80">· {config.targetShapes} shapes</span>
              )}
            </Badge>
            {config.noteVisibility && (
              <Badge
                variant="outline"
                className="border-white/30 bg-white/10 text-white backdrop-blur-sm"
              >
                {config.noteVisibility === "hidden" ? (
                  <EyeOff className="mr-1 size-3" />
                ) : (
                  <Eye className="mr-1 size-3" />
                )}
                {config.noteVisibility === "all"
                  ? "All Notes"
                  : config.noteVisibility === "roots"
                    ? "Roots Only"
                    : "Hidden"}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              {config.key === "random" ? (
                <Dices className="size-5 text-white" />
              ) : (
                <span className="font-display text-lg font-bold text-white">{config.key}</span>
              )}
            </div>
            <div>
              <p className="text-[10px] font-medium tracking-wider text-white/50 uppercase">Key</p>
              <p className="text-sm font-semibold text-white">
                {config.key === "random" ? "Random" : config.key}
              </p>
            </div>
          </div>

          {!hideShapes && (
            <>
              <div className="h-8 w-px bg-white/20" />

              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <Music className="size-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-medium tracking-wider text-white/50 uppercase">
                    Shapes
                  </p>
                  <div className="flex items-center gap-1.5">
                    {config.shapes.map((shape) => (
                      <span
                        key={shape}
                        className="flex size-5 items-center justify-center rounded bg-white/20 text-[10px] font-bold text-white"
                      >
                        {shape}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
