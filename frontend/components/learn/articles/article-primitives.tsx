"use client"

import { cn } from "@/lib/utils"

export function ArticleSection({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <section className={cn("space-y-6", className)}>{children}</section>
}

export function ArticleHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
      {children}
    </h2>
  )
}

export function ArticleSubheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
      {children}
    </h3>
  )
}

export function ArticleParagraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-base leading-relaxed sm:text-lg sm:leading-relaxed">
      {children}
    </p>
  )
}

export function HighlightBox({
  children,
  icon: Icon,
  variant = "default",
  title,
}: {
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  variant?: "default" | "tip" | "important" | "note"
  title?: string
}) {
  const variants = {
    default: "from-primary/5 to-primary/10 border-primary/20",
    tip: "from-emerald-500/5 to-emerald-500/10 border-emerald-500/20",
    important: "from-amber-500/5 to-amber-500/10 border-amber-500/20",
    note: "from-sky-500/5 to-sky-500/10 border-sky-500/20",
  }

  const iconColors = {
    default: "text-primary",
    tip: "text-emerald-500",
    important: "text-amber-500",
    note: "text-sky-500",
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6",
        variants[variant],
      )}
    >
      <div className="flex gap-4">
        {Icon && (
          <div className="flex-shrink-0">
            <Icon className={cn("size-5", iconColors[variant])} />
          </div>
        )}
        <div className="space-y-2">
          {title && <p className="text-foreground font-semibold">{title}</p>}
          <div className="text-muted-foreground text-sm sm:text-base">{children}</div>
        </div>
      </div>
    </div>
  )
}

export const FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21]
export const STRING_NAMES = ["E", "B", "G", "D", "A", "E"]

export interface FretPosition {
  string: number
  fret: number
  degree?: "1" | "3" | "5"
}

export interface FretboardDiagramProps {
  positions: FretPosition[]
  highlightFrets?: [number, number]
  showOpenStrings?: boolean
  title?: string
  className?: string
  compact?: boolean
  showDegreeLabels?: boolean
}

const DEGREE_COLORS = {
  "1": {
    bg: "from-emerald-400 to-teal-600",
    shadow: "shadow-emerald-500/30",
    label: "R",
  },
  "3": {
    bg: "from-amber-400 to-orange-500",
    shadow: "shadow-amber-500/30",
    label: "3",
  },
  "5": {
    bg: "from-sky-400 to-blue-500",
    shadow: "shadow-sky-500/30",
    label: "5",
  },
}

export function FretboardDiagram({
  positions,
  highlightFrets = [0, 4],
  showOpenStrings = true,
  title,
  className,
  compact = false,
  showDegreeLabels = true,
}: FretboardDiagramProps) {
  const [startFret, endFret] = highlightFrets
  const fretCount = endFret - startFret + 1

  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <p className="text-muted-foreground text-center text-sm font-medium">{title}</p>
      )}
      <div className="relative mx-auto w-full max-w-md">
        {/* Fret numbers */}
        <div
          className="mb-1 flex justify-between px-6"
          style={{ paddingLeft: showOpenStrings ? "2.5rem" : "0.5rem" }}
        >
          {Array.from({ length: fretCount }, (_, i) => startFret + i).map((fret) => (
            <span
              key={fret}
              className={cn(
                "text-muted-foreground/60 w-8 text-center text-xs",
                FRET_MARKERS.includes(fret) && "text-muted-foreground font-medium",
              )}
            >
              {fret === 0 ? "" : fret}
            </span>
          ))}
        </div>

        {/* Fretboard */}
        <div className="bg-gradient-to-b from-amber-900/90 to-amber-950 relative rounded-lg p-2 shadow-lg">
          {/* Nut (if showing open position) */}
          {startFret === 0 && (
            <div className="absolute top-0 bottom-0 left-6 w-1.5 rounded-l bg-gradient-to-b from-stone-200 to-stone-400" />
          )}

          {/* Strings and frets grid */}
          <div className="relative">
            {STRING_NAMES.map((stringName, stringIndex) => (
              <div key={stringIndex} className="flex items-center">
                {/* String name */}
                {showOpenStrings && (
                  <span className="text-muted-foreground/70 w-4 pr-1 text-right text-xs">
                    {stringName}
                  </span>
                )}

                {/* Frets for this string */}
                <div className="flex flex-1">
                  {Array.from({ length: fretCount }, (_, fretIndex) => {
                    const actualFret = startFret + fretIndex
                    const position = positions.find(
                      (pos) => pos.string === stringIndex && pos.fret === actualFret,
                    )

                    return (
                      <div
                        key={fretIndex}
                        className={cn(
                          "relative flex h-7 flex-1 items-center justify-center border-r border-amber-700/50",
                          fretIndex === 0 && startFret === 0 && "border-l-2 border-l-stone-300",
                          compact && "h-5",
                        )}
                      >
                        {/* String line */}
                        <div
                          className={cn(
                            "absolute top-1/2 right-0 left-0 h-px -translate-y-1/2",
                            stringIndex <= 1 && "bg-stone-300/80",
                            stringIndex === 2 && "bg-stone-400/80",
                            stringIndex >= 3 && "h-0.5 bg-stone-500/90",
                          )}
                        />

                        {/* Note indicator */}
                        {position && (
                          <div
                            className={cn(
                              "relative z-10 flex items-center justify-center rounded-full shadow-md",
                              compact ? "size-4" : "size-5",
                              position.degree
                                ? cn(
                                    "bg-gradient-to-br",
                                    DEGREE_COLORS[position.degree].bg,
                                    DEGREE_COLORS[position.degree].shadow,
                                  )
                                : "bg-gradient-to-br from-emerald-400 to-teal-600 shadow-emerald-500/30",
                            )}
                          >
                            {showDegreeLabels && (
                              <span className="text-[10px] font-bold text-white">
                                {position.degree
                                  ? DEGREE_COLORS[position.degree].label
                                  : "R"}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Fret marker dots */}
                        {stringIndex === 2 &&
                          FRET_MARKERS.includes(actualFret) &&
                          actualFret !== 12 && (
                            <div className="bg-stone-600/30 absolute bottom-0 left-1/2 size-2 -translate-x-1/2 translate-y-4 rounded-full" />
                          )}
                        {stringIndex === 1 && actualFret === 12 && (
                          <div className="bg-stone-600/30 absolute bottom-0 left-1/2 size-2 -translate-x-1/2 translate-y-4 rounded-full" />
                        )}
                        {stringIndex === 3 && actualFret === 12 && (
                          <div className="bg-stone-600/30 absolute bottom-0 left-1/2 size-2 -translate-x-1/2 translate-y-4 rounded-full" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export const CAGED_SHAPE_COLORS = {
  C: {
    color: "from-rose-500 to-pink-600",
    shadowColor: "shadow-rose-500/30",
    bgGlow: "from-rose-500/10 to-pink-500/10",
  },
  A: {
    color: "from-amber-500 to-orange-600",
    shadowColor: "shadow-amber-500/30",
    bgGlow: "from-amber-500/10 to-orange-500/10",
  },
  G: {
    color: "from-emerald-500 to-green-600",
    shadowColor: "shadow-emerald-500/30",
    bgGlow: "from-emerald-500/10 to-green-500/10",
  },
  E: {
    color: "from-sky-500 to-blue-600",
    shadowColor: "shadow-sky-500/30",
    bgGlow: "from-sky-500/10 to-blue-500/10",
  },
  D: {
    color: "from-violet-500 to-purple-600",
    shadowColor: "shadow-violet-500/30",
    bgGlow: "from-violet-500/10 to-purple-500/10",
  },
} as const

export type CagedShapeLetter = keyof typeof CAGED_SHAPE_COLORS
