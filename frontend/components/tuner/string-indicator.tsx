"use client"

import { cn } from "@/lib/utils"
import { type TuningString } from "./tuner-controls"

interface StringIndicatorProps {
  strings: TuningString[]
  activeString: number | null
  detectedNote: string | null
  detectedFrequency: number | null
  onStringSelect?: (stringIndex: number) => void
}

function findClosestString(frequency: number | null, strings: TuningString[]): number | null {
  if (frequency === null || frequency <= 0) return null

  let closestIndex = 0
  let minCentsDiff = Infinity

  for (let i = 0; i < strings.length; i++) {
    const stringFreq = strings[i].frequency
    const centsDiff = Math.abs(1200 * Math.log2(frequency / stringFreq))
    if (centsDiff < minCentsDiff) {
      minCentsDiff = centsDiff
      closestIndex = i
    }
  }

  if (minCentsDiff > 100) return null
  return closestIndex
}

export default function StringIndicator({
  strings,
  activeString,
  detectedNote,
  detectedFrequency,
  onStringSelect,
}: StringIndicatorProps) {
  const detectedStringIndex = findClosestString(detectedFrequency, strings)

  return (
    <div className="flex flex-col gap-3">
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Guitar Strings
      </div>

      <div className="flex items-center justify-between gap-2">
        {strings.map((string, index) => {
          const isActive = activeString === index
          const isDetected = detectedStringIndex === index

          return (
            <button
              key={`${string.note}-${index}`}
              type="button"
              aria-label={`String ${index + 1}: ${string.note}`}
              aria-pressed={isActive || isDetected}
              onClick={() => onStringSelect?.(index)}
              className={cn(
                "group relative flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-3 transition-all duration-200",
                isActive || isDetected
                  ? "bg-primary/10 border-primary/30"
                  : "bg-background-elevated hover:bg-accent/50 hover:border-border border-transparent",
              )}
            >
              <div className="relative">
                <div
                  className={cn(
                    "absolute -inset-1 rounded-full opacity-0 blur-sm transition-opacity",
                    (isActive || isDetected) && "opacity-50",
                  )}
                  style={{ background: "var(--primary)" }}
                />
                <div
                  className={cn(
                    "font-display relative text-lg font-bold transition-colors",
                    isActive || isDetected
                      ? "text-primary"
                      : "text-foreground group-hover:text-primary",
                  )}
                >
                  {string.note.replace(/[0-9]/g, "")}
                </div>
              </div>

              <div
                className={cn(
                  "font-mono text-[10px] tabular-nums transition-colors",
                  isActive || isDetected ? "text-primary/70" : "text-muted-foreground",
                )}
              >
                {string.frequency.toFixed(0)}
              </div>

              <div
                className={cn(
                  "absolute -bottom-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full transition-all duration-300",
                  isActive || isDetected ? "bg-primary opacity-100" : "bg-transparent opacity-0",
                )}
              />
            </button>
          )
        })}
      </div>

      <div className="text-muted-foreground/70 flex items-center justify-between px-1 text-[10px]">
        <span>Low E (thickest)</span>
        <span>High E (thinnest)</span>
      </div>
    </div>
  )
}
