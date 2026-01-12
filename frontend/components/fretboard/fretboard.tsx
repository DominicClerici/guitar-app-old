"use client"

const DEFAULT_TUNING = ["E", "A", "D", "G", "B", "E"] as const
const STRING_THICKNESSES = [3.5, 3, 2.5, 2, 1.5, 1]
const FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]
const STRING_COUNT = 6
const FRET_COUNT = 19 // 0 (nut) through 18

const SVG_WIDTH = 900
const SVG_HEIGHT = 200
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

type Marker = {
  stringIndex: number
  fretIndex: number
  type: MarkerType
  label: string
}

type FretboardProps = {
  tuning?: readonly string[]
  markers?: Marker[]
  className?: string
}

const getStringY = (stringIndex: number): number => {
  return ((STRING_COUNT - stringIndex) / (STRING_COUNT + 1)) * SVG_HEIGHT
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
}: FretboardProps) {
  const getMarkerStyle = (type: MarkerType) => {
    const isHidden = type.includes("hidden")
    const isDisabled = type.includes("disabled")
    const isRoot = type.includes("root")
    return {
      fillClass: isRoot ? "fill-primary" : "fill-foreground",
      textClass: isRoot ? "fill-primary-foreground" : "fill-background",
      opacity: isHidden ? 0 : isDisabled ? 0.4 : 1,
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
          height={SVG_HEIGHT}
          className={isNut ? "fill-foreground" : "fill-muted"}
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
              cy={SVG_HEIGHT / 2 - gap / 2}
              r={FRET_DOT_RADIUS}
              className="fill-muted"
              opacity={0.5}
            />
            <circle
              cx={cx}
              cy={SVG_HEIGHT / 2 + gap / 2}
              r={FRET_DOT_RADIUS}
              className="fill-muted"
              opacity={0.5}
            />
          </g>
        )
      }

      return (
        <circle
          key={`fret-marker-${fretNumber}`}
          cx={cx}
          cy={SVG_HEIGHT / 2}
          r={FRET_DOT_RADIUS}
          className="fill-muted"
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
          className="fill-muted"
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
          className="fill-muted-foreground text-xs font-semibold"
          style={{ fontSize: 12 }}
        >
          {note}
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

      return (
        <g
          key={`marker-${marker.stringIndex}-${marker.fretIndex}-${index}`}
          opacity={style.opacity}
        >
          <circle cx={cx} cy={cy} r={MARKER_RADIUS} className={style.fillClass} />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            className={`${style.textClass} font-bold`}
            style={{ fontSize: 12 }}
          >
            {marker.label}
          </text>
        </g>
      )
    })
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className={`border-border border-y ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {renderFrets()}
      {renderFretMarkers()}
      {renderStrings()}
      {renderTuningLabels()}
      {renderNoteMarkers()}
    </svg>
  )
}

export type { FretboardProps, Marker, MarkerType }
