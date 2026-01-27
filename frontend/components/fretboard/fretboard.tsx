"use client"

const DEFAULT_TUNING = ["E", "A", "D", "G", "B", "E"] as const
const STRING_THICKNESSES = [3.5, 3, 2.5, 2, 1.5, 1]
const FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]
const STRING_COUNT = 6
const FRET_COUNT = 19 // 0 (nut) through 18

const SVG_WIDTH = 900
const SVG_HEIGHT = 220
const FRET_LABEL_AREA_HEIGHT = 20
const FRET_WIDTH = SVG_WIDTH / FRET_COUNT
const MARKER_RADIUS = 14
const FRET_DOT_RADIUS = 6

type MarkerType =
  | "root-disabled"
  | "root"
  | "note-disabled"
  | "note"
  | "root-hidden"
  | "note-hidden"
  | "chord-tone"
  | "chord-tone-disabled"
  | "chord-tone-hidden"
  | "played"

type Marker = {
  stringIndex: number
  fretIndex: number
  type: MarkerType
  label: string
  degree?: number
}

type FretboardProps = {
  tuning?: readonly string[]
  markers?: Marker[]
  className?: string
  showDegree?: boolean
  onFretClick?: (stringIndex: number, fretIndex: number) => void
}

const FRETBOARD_HEIGHT = SVG_HEIGHT - FRET_LABEL_AREA_HEIGHT

const getStringY = (stringIndex: number): number => {
  return ((STRING_COUNT - stringIndex - 0.5) / STRING_COUNT) * FRETBOARD_HEIGHT
}

const getFretX = (fretIndex: number): number => {
  return fretIndex * FRET_WIDTH
}

const getFretCenterX = (fretIndex: number): number => {
  return getFretX(fretIndex) + FRET_WIDTH / 2
}

export function Fretboard({
  tuning = DEFAULT_TUNING,
  markers = [],
  className = "",
  showDegree = false,
  onFretClick,
}: FretboardProps) {
  const getMarkerStyle = (type: MarkerType) => {
    const isHidden = type.includes("hidden")
    const isDisabled = type.includes("disabled")
    const isRoot = type.includes("root")
    const isChordTone = type.includes("chord-tone")
    if (type === "played") {
      return {
        fill: "var(--primary)",
        textColor: "var(--primary-foreground)",
        borderColor: "var(--primary-border)",
        opacity: 1,
        isRoot,
      }
    }
    if (isChordTone) {
      return {
        fill: "var(--background-elevated)",
        textColor: "var(--muted-foreground)",
        borderColor: "var(--border)",
        opacity: isHidden ? 0 : isDisabled ? 0.25 : 1,
        isRoot: false,
      }
    }
    return {
      fill: isRoot ? "var(--accent)" : "var(--background-elevated)",
      textColor: isRoot ? "var(--foreground)" : "var(--muted-foreground)",
      borderColor: isRoot
        ? "color-mix(in srgb, var(--muted-foreground) 50%, transparent)"
        : "var(--border)",
      opacity: isHidden ? 0 : isDisabled ? 0.25 : 1,
      isRoot,
    }
  }

  const renderFrets = () => {
    return Array.from({ length: FRET_COUNT }, (_, fretNumber) => {
      const isNut = fretNumber === 0
      const x = getFretX(fretNumber)
      const width = isNut ? 6 : 2

      return (
        <rect
          key={`fret-${fretNumber}`}
          x={x}
          y={0}
          width={width}
          height={FRETBOARD_HEIGHT}
          className={isNut ? "fill-accent" : "fill-card"}
        />
      )
    })
  }

  const renderFretMarkers = () => {
    return FRET_MARKERS.filter((fretNumber) => fretNumber < FRET_COUNT).map((fretNumber) => {
      const cx = getFretCenterX(fretNumber)
      const isDoubleDot = fretNumber === 12

      if (isDoubleDot) {
        const gap = 32
        return (
          <g key={`fret-marker-${fretNumber}`}>
            <circle
              cx={cx}
              cy={FRETBOARD_HEIGHT / 2 - gap}
              r={FRET_DOT_RADIUS}
              className="fill-accent"
              opacity={0.5}
            />
            <circle
              cx={cx}
              cy={FRETBOARD_HEIGHT / 2 + gap}
              r={FRET_DOT_RADIUS}
              className="fill-accent"
              opacity={0.5}
            />
          </g>
        )
      }

      return (
        <circle
          key={`fret-marker-${fretNumber}`}
          cx={cx}
          cy={FRETBOARD_HEIGHT / 2}
          r={FRET_DOT_RADIUS}
          className="fill-accent"
          opacity={0.5}
        />
      )
    })
  }

  const renderStrings = () => {
    return tuning.map((_, stringIndex) => {
      const y = getStringY(stringIndex)
      const thickness = STRING_THICKNESSES[stringIndex]

      return (
        <rect
          key={`string-${stringIndex}`}
          x={FRET_WIDTH}
          y={y - thickness / 2}
          width={SVG_WIDTH - FRET_WIDTH}
          height={thickness}
          className="fill-card"
        />
      )
    })
  }

  const renderTuningLabels = () => {
    return tuning.map((note, stringIndex) => {
      const y = getStringY(stringIndex)
      const x = FRET_WIDTH / 2

      return (
        <text
          key={`tuning-${stringIndex}`}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground/50 font-semibold"
          style={{ fontSize: 10 }}
        >
          {note}
        </text>
      )
    })
  }

  const renderFretLabels = () => {
    return Array.from({ length: FRET_COUNT - 1 }, (_, i) => {
      const fretNumber = i + 1
      const cx = getFretCenterX(fretNumber)
      const cy = FRETBOARD_HEIGHT + FRET_LABEL_AREA_HEIGHT / 2

      return (
        <text
          key={`fret-label-${fretNumber}`}
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground text-xs"
          style={{ fontSize: 10 }}
        >
          {fretNumber}
        </text>
      )
    })
  }

  const renderNoteMarkers = () => {
    return markers.map((marker, index) => {
      if (marker.fretIndex < 0 || marker.fretIndex >= FRET_COUNT) return null

      const style = getMarkerStyle(marker.type)
      const cx = getFretCenterX(marker.fretIndex)
      const cy = getStringY(marker.stringIndex)
      const displayLabel =
        showDegree && marker.degree !== undefined ? String(marker.degree) : marker.label

      return (
        <g
          key={`marker-${marker.stringIndex}-${marker.fretIndex}-${index}`}
          className="animate-marker-in"
          style={{ "--marker-opacity": style.opacity } as React.CSSProperties}
        >
          {style.isRoot ? (
            <rect
              x={cx - MARKER_RADIUS}
              y={cy - MARKER_RADIUS}
              width={MARKER_RADIUS * 2}
              height={MARKER_RADIUS * 2}
              rx={6}
              fill={style.fill}
              stroke={style.borderColor}
              strokeWidth={1}
            />
          ) : (
            <circle
              cx={cx}
              cy={cy}
              r={MARKER_RADIUS}
              fill={style.fill}
              stroke={style.borderColor}
              strokeWidth={1}
            />
          )}
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill={style.textColor}
            className={`font-bold`}
            style={{ fontSize: 12 }}
          >
            {displayLabel}
          </text>
        </g>
      )
    })
  }

  const renderClickableAreas = () => {
    if (!onFretClick) return null

    return tuning.flatMap((_, stringIndex) =>
      Array.from({ length: FRET_COUNT }, (_, fretIndex) => {
        const cx = getFretCenterX(fretIndex)
        const cy = getStringY(stringIndex)

        return (
          <rect
            key={`click-${stringIndex}-${fretIndex}`}
            x={cx - FRET_WIDTH / 2}
            y={cy - FRETBOARD_HEIGHT / STRING_COUNT / 2}
            width={FRET_WIDTH}
            height={FRETBOARD_HEIGHT / STRING_COUNT}
            fill="transparent"
            className="hover:fill-foreground/10 cursor-pointer"
            onClick={() => onFretClick(stringIndex, fretIndex)}
          />
        )
      }),
    )
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <line
        x1={0}
        y1={FRETBOARD_HEIGHT}
        x2={SVG_WIDTH}
        y2={FRETBOARD_HEIGHT}
        stroke="var(--border)"
        strokeWidth={1}
      />
      <line x1={0} y1={0.5} x2={SVG_WIDTH} y2={0.5} strokeWidth={1} stroke="var(--border)" />
      {renderFrets()}
      {renderFretMarkers()}
      {renderStrings()}
      {renderTuningLabels()}
      {renderFretLabels()}
      {renderNoteMarkers()}
      {renderClickableAreas()}
    </svg>
  )
}

export type { FretboardProps, Marker, MarkerType }
