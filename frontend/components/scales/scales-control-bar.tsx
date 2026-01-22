import { cn } from "@/lib/utils"
import { Clock, InfinityIcon, Layers } from "lucide-react"
import { formatTime } from "./scales-practice-client"

interface ScaleCurrentPositionInfoProps {
  shapeName: string
  notesPlayed: number | string
  totalNotes: number | string
  className?: string
}
export function ScaleCurrentPositionInfo({
  shapeName,
  notesPlayed,
  totalNotes,
  className,
}: ScaleCurrentPositionInfoProps) {
  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div className="flex flex-col">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Shape
        </span>
        <span className="font-display text-2xl font-bold tracking-tight">{shapeName}</span>
      </div>

      <div className="bg-border h-10 w-px" />

      <div className="flex flex-col">
        <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Notes
        </span>
        <div className="flex items-baseline gap-1">
          <span className="font-display text-primary text-2xl font-bold tabular-nums">
            {notesPlayed}
          </span>
          <span className="text-muted-foreground text-sm font-medium">/ {totalNotes}</span>
        </div>
      </div>
    </div>
  )
}

interface ScaleTimerInfoProps {
  timer: number
  sessionType: "infinite" | "timed" | "shapes"
  initialDurationSeconds: number
  className?: string
  practiceState: "idle" | "countdown" | "practicing" | "paused" | "between-shapes" | "complete"
  completedShapesCount: number
  targetShapes: number
}

export function ScaleTimerInfo({
  timer,
  sessionType,
  initialDurationSeconds,
  className,
  practiceState,
  completedShapesCount,
  targetShapes,
}: ScaleTimerInfoProps) {
  return (
    <div className={cn("flex items-center justify-center justify-self-center", className)}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl px-5 py-2.5 transition-colors",
          practiceState === "paused" ? "bg-muted" : "bg-primary/10",
        )}
      >
        {sessionType === "infinite" && (
          <>
            <InfinityIcon
              className={cn(
                "size-5",
                practiceState === "paused" ? "text-muted-foreground" : "text-primary",
              )}
            />
            <span
              className={cn(
                "font-display text-3xl font-bold tracking-tight tabular-nums",
                practiceState === "paused" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {formatTime(timer)}
            </span>
          </>
        )}

        {sessionType === "timed" && (
          <>
            <Clock
              className={cn(
                "size-5",
                practiceState === "paused"
                  ? "text-muted-foreground"
                  : timer <= 30
                    ? "text-destructive animate-pulse"
                    : "text-primary",
              )}
            />
            <span
              className={cn(
                "font-display text-3xl font-bold tracking-tight tabular-nums",
                practiceState === "paused"
                  ? "text-muted-foreground"
                  : timer <= 30
                    ? "text-destructive"
                    : "text-foreground",
              )}
            >
              {formatTime(timer)}
            </span>
            {/* Progress bar for timed mode */}
            {initialDurationSeconds > 0 && (
              <div className="bg-muted ml-2 h-2 w-20 overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full transition-all duration-1000 ease-linear",
                    timer <= 30 ? "bg-destructive" : "bg-primary",
                  )}
                  style={{
                    width: `${(timer / initialDurationSeconds) * 100}%`,
                  }}
                />
              </div>
            )}
          </>
        )}

        {sessionType === "shapes" && (
          <>
            <Layers
              className={cn(
                "size-5",
                practiceState === "paused" ? "text-muted-foreground" : "text-primary",
              )}
            />
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "font-display text-3xl font-bold tabular-nums",
                  practiceState === "paused" ? "text-muted-foreground" : "text-primary",
                )}
              >
                {completedShapesCount}
              </span>
              <span
                className={cn(
                  "text-lg font-medium",
                  practiceState === "paused" ? "text-muted-foreground/60" : "text-muted-foreground",
                )}
              >
                / {targetShapes}
              </span>
            </div>
            {/* Progress bar for shapes mode */}
            <div className="bg-muted ml-2 h-2 w-20 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{
                  width: `${(completedShapesCount / targetShapes) * 100}%`,
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
