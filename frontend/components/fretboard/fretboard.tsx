"use client"

const DEFAULT_TUNING = ["E", "A", "D", "G", "B", "E"] as const
const STRING_THICKNESSES = [3.5, 3, 2.5, 2, 1.5, 1]
const FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]
const STRING_COUNT = 6
const FRET_COUNT = 19 // 0 (nut) through 18

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

export function Fretboard({
  tuning = DEFAULT_TUNING,
  markers = [],
  className = "",
}: FretboardProps) {
  const frets = Array.from({ length: FRET_COUNT }, (_, i) => i)

  const getMarkerColors = (type: MarkerType) => {
    const isHidden = type.includes("hidden")
    const isDisabled = type.includes("disabled")
    const isRoot = type.includes("root")
    return {
      background: isRoot ? "bg-primary" : "bg-foreground",
      text: isRoot ? "text-primary-foreground" : "text-background",
      opacity: isHidden ? "opacity-0" : isDisabled ? "opacity-40" : "opacity-100",
    }
  }

  const renderMarker = (marker: Marker, index: number) => {
    if (marker.fretIndex < 0 || marker.fretIndex >= FRET_COUNT) return null

    const markerColors = getMarkerColors(marker.type)
    const leftPercent = (marker.fretIndex / FRET_COUNT) * 100 + 100 / FRET_COUNT / 2
    const topPercent = ((STRING_COUNT - marker.stringIndex) / (STRING_COUNT + 1)) * 100

    return (
      <div
        key={`${marker.stringIndex}-${marker.fretIndex}-${index}`}
        className={`absolute flex h-7 w-7 items-center justify-center rounded-full ${markerColors.background} ${markerColors.opacity}`}
        style={{
          left: `${leftPercent}%`,
          top: `${topPercent}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <span className={`text-xs font-bold ${markerColors.text}`}>{marker.label}</span>
      </div>
    )
  }

  const renderFret = (fretNumber: number) => {
    const isNut = fretNumber === 0
    const hasMarker = FRET_MARKERS.includes(fretNumber)
    const isDoubleDot = fretNumber === 12

    return (
      <div key={fretNumber} className="relative h-full" style={{ width: `${100 / FRET_COUNT}%` }}>
        <div
          className={`absolute top-0 bottom-0 left-0 ${isNut ? "bg-foreground" : "bg-muted"}`}
          style={{ width: isNut ? 6 : 2 }}
        />

        {hasMarker && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {isDoubleDot ? (
              <div className="flex flex-col gap-8">
                <div className="bg-muted h-3 w-3 rounded-full opacity-50" />
                <div className="bg-muted h-3 w-3 rounded-full opacity-50" />
              </div>
            ) : (
              <div className="bg-muted h-3 w-3 rounded-full opacity-50" />
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`border-border relative overflow-hidden border-y ${className}`}
      style={{ height: 200 }}
    >
      <div className="flex h-full">{frets.map(renderFret)}</div>

      <div className="pointer-events-none absolute inset-0">
        {tuning.map((_, stringIndex) => {
          const topPercent = ((STRING_COUNT - stringIndex) / (STRING_COUNT + 1)) * 100
          return (
            <div
              key={stringIndex}
              className="bg-muted absolute"
              style={{
                top: `${topPercent}%`,
                height: STRING_THICKNESSES[stringIndex],
                left: `${100 / FRET_COUNT}%`,
                right: 0,
                transform: "translateY(-50%)",
              }}
            />
          )
        })}
      </div>

      <div className="pointer-events-none absolute inset-0">
        {tuning.map((note, stringIndex) => {
          const topPercent = ((STRING_COUNT - stringIndex) / (STRING_COUNT + 1)) * 100
          return (
            <div
              key={stringIndex}
              className="text-muted-foreground absolute w-4 text-center text-xs font-semibold"
              style={{
                top: `${topPercent}%`,
                left: `${100 / FRET_COUNT / 2}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {note}
            </div>
          )
        })}
      </div>

      <div className="pointer-events-none absolute inset-0">{markers.map(renderMarker)}</div>
    </div>
  )
}

export type { FretboardProps, Marker, MarkerType }
