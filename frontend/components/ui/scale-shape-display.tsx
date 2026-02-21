import { cn } from "@/lib/utils"

interface ScaleShapeDisplayProps {
  selected?: boolean
  onClick?: () => void
  label?: string
  data: number[][]
  isDimmed?: (stringIndex: number, fret: number) => boolean
  className?: string
}

export default function ScaleShapeDisplay({
  selected = false,
  onClick,
  label,
  data,
  isDimmed,
  className,
}: ScaleShapeDisplayProps) {
  const allFrets = data.flat()
  const minFret = Math.min(...allFrets)
  const maxFret = Math.max(...allFrets)
  const noteRange = maxFret - minFret + 1

  const STRINGS = 6
  const FW = 12
  const SG = 8
  const PY = 5
  const DOT_R = 2.5
  const FRET_SLOTS = 5

  const vw = FRET_SLOTS * FW
  const vh = PY * 2 + (STRINGS - 1) * SG
  const fadePct = (FW / 2 / vw) * 100
  const offsetX = ((FRET_SLOTS - noteRange) * FW) / 2

  const dotX = (fret: number) => offsetX + (fret - minFret) * FW + FW / 2
  const sY = (i: number) => PY + i * SG

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-md border py-1",
        onClick && "cursor-pointer",
        selected
          ? "border-primary bg-primary/10"
          : "border-border hover:border-primary/50 hover:bg-accent",
        className,
      )}
    >
      {label && (
        <span
          className={cn(
            "text-sm leading-none font-semibold",
            selected ? "text-primary" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
      )}

      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        className="block w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{
          maskImage: `linear-gradient(to right, transparent 0%, black ${fadePct}%, black ${100 - fadePct}%, transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to right, transparent 0%, black ${fadePct}%, black ${100 - fadePct}%, transparent 100%)`,
        }}
      >
        {Array.from({ length: FRET_SLOTS + 1 }, (_, i) => (
          <line
            key={`f${i}`}
            x1={i * FW}
            y1={PY}
            x2={i * FW}
            y2={vh - PY}
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-border"
          />
        ))}

        {Array.from({ length: STRINGS }, (_, i) => (
          <line
            key={`s${i}`}
            x1={0}
            y1={sY(i)}
            x2={vw}
            y2={sY(i)}
            stroke="currentColor"
            strokeWidth={0.5 + i * 0.08}
            className="text-muted-foreground/50"
          />
        ))}

        {data.map((frets, di) =>
          frets.map((fret) => (
            <circle
              key={`${di}-${fret}`}
              cx={dotX(fret)}
              cy={sY(5 - di)}
              r={DOT_R}
              className={selected ? "fill-primary" : "fill-muted-foreground"}
              opacity={isDimmed?.(di, fret) ? 0.15 : undefined}
            />
          )),
        )}
      </svg>
    </button>
  )
}
