"use client"

import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp, Check } from "lucide-react"

interface TunerNoteDisplayProps {
  note: string | null
  frequency: number | null
  cents: number | null
  isInTune: boolean
  isListening: boolean
}

export default function TunerNoteDisplay({
  note,
  frequency,
  cents,
  isInTune,
  isListening,
}: TunerNoteDisplayProps) {
  const getStatusInfo = () => {
    if (!isListening || cents === null) {
      return { text: "Waiting for input...", icon: null }
    }
    if (isInTune) {
      return { text: "In tune!", icon: Check }
    }
    if (cents > 0) {
      return { text: "Tune down", icon: ArrowDown }
    }
    return { text: "Tune up", icon: ArrowUp }
  }

  const { text: statusText, icon: StatusIcon } = getStatusInfo()

  const getTuningColor = () => {
    if (!isListening || cents === null) return "text-muted-foreground"
    if (isInTune) return "text-in-tune"
    if (Math.abs(cents) <= 15) return "text-slight-out-of-tune"
    return "text-out-of-tune"
  }

  return (
    <div className="relative flex flex-col items-center justify-center gap-4 py-6">
      <div
        className={cn(
          "absolute inset-0 rounded-2xl opacity-0 blur-3xl transition-opacity duration-500",
          isInTune && isListening && "opacity-30",
        )}
        style={{
          background: "radial-gradient(circle, var(--in-tune) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-2">
        <div
          className={cn(
            "font-display text-8xl font-bold tracking-tighter transition-all duration-300 sm:text-9xl",
            getTuningColor(),
            !isListening && "opacity-40",
          )}
        >
          {note ?? "--"}
        </div>

        <div className="text-muted-foreground flex items-baseline gap-1 font-mono text-lg tabular-nums">
          {frequency !== null && frequency > 0 ? (
            <>{frequency.toFixed(1)} Hz</>
          ) : (
            <span className="opacity-50">--- Hz</span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          className={cn(
            "flex h-9 min-w-24 items-center justify-center gap-2 rounded-full px-4 font-mono text-sm font-medium tabular-nums transition-all duration-300",
            isInTune && isListening
              ? "bg-in-tune/15 text-in-tune border-in-tune/30 border"
              : cents !== null && Math.abs(cents) <= 15
                ? "bg-slight-out-of-tune/15 text-slight-out-of-tune border-slight-out-of-tune/30 border"
                : cents !== null
                  ? "bg-out-of-tune/15 text-out-of-tune border-out-of-tune/30 border"
                  : "bg-muted/50 text-muted-foreground border border-transparent",
          )}
        >
          {cents !== null ? (
            <>
              {cents > 0 ? "+" : ""}
              {cents.toFixed(0)} cents
            </>
          ) : (
            <span>-- cents</span>
          )}
        </div>

        <div
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium transition-colors duration-300",
            getTuningColor(),
          )}
        >
          {StatusIcon && <StatusIcon className="size-4" />}
          <span>{statusText}</span>
        </div>
      </div>
    </div>
  )
}
