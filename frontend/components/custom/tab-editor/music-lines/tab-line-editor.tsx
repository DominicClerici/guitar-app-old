import { Button } from "@/components/ui/button"
import { PauseIcon, PlayIcon, SquareIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Tone from "tone"
import { NoteEvent } from "../context/tab-data-context"
import { PlayerCallbacks, STANDARD_TUNING_NOTES } from "../context/tab-player-context"
import useTabContext from "../tab-context-main"

export type TabNote = {
  string: number // 0-5 (0 = high E, 5 = low E)
  fret: number // 0-23
  position: number // 0-31 (position within the bar, represents 32nd note intervals)
}
export type NoteInterval = "16th" | "32nd" | "64th"

const INTERVAL_CONFIG: Record<NoteInterval, { positionsPerBar: number; divisor: number }> = {
  "16th": { positionsPerBar: 16, divisor: 4 }, // 4 16th notes per beat, 16 per bar in 4/4
  "32nd": { positionsPerBar: 32, divisor: 8 }, // 8 32nd notes per beat, 32 per bar in 4/4
  "64th": { positionsPerBar: 64, divisor: 16 }, // 16 64th notes per beat, 64 per bar in 4/4
}

const MELODY_PLAYER_ID = "tab-line-editor"

// A bar contains notes at various positions
export type TabBar = {
  id: string
  notes: TabNote[]
}

// The complete tab structure
export type Tab = {
  bars: TabBar[]
  bpm: number // Beats per minute for playback
  timeSignature: [number, number] // e.g., [4, 4] for 4/4 time
}

// Minimum cell width in pixels (w-3 = 12px)
const MIN_CELL_WIDTH = 12
// String label width in pixels (w-5 = 20px)
const STRING_LABEL_WIDTH = 20
// Gap between bars in a row (gap-4 = 16px)
const BAR_GAP = 16

function generateBarId(): string {
  return `bar-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

function createEmptyBar(): TabBar {
  return {
    id: generateBarId(),
    notes: [],
  }
}

type CellPosition = {
  barIndex: number
  string: number
  position: number
}

export default function TabLineEditor() {
  const {
    isPlaying,
    startPlayback,
    stopPlayback,
    registerPlayer,
    unregisterPlayer,
    playNote,
    timeSignature,
  } = useTabContext()

  const [bars, setBars] = useState<TabBar[]>([createEmptyBar()])
  const [interval, setInterval] = useState<NoteInterval>("32nd")
  // Container ref for responsive sizing
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Playback state tracking
  const [currentBarIndex, setCurrentBarIndex] = useState(0)
  const [currentPosition, setCurrentPosition] = useState(0)
  const positionUpdateRef = useRef<number | null>(null)
  const melodyPartRef = useRef<Tone.Part | null>(null)

  // Track total melody bars for independent looping
  const totalMelodyBarsRef = useRef(1)

  // Refs to avoid stale closures in Tone.Part callbacks
  const barsRef = useRef(bars)
  const intervalRef = useRef(interval)

  useEffect(() => {
    barsRef.current = bars
  }, [bars])

  useEffect(() => {
    intervalRef.current = interval
  }, [interval])

  // Measure container width on mount and resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    resizeObserver.observe(container)
    // Initial measurement
    setContainerWidth(container.clientWidth)

    return () => resizeObserver.disconnect()
  }, [])

  // Get positions per bar based on current interval
  const positionsPerBar = INTERVAL_CONFIG[interval].positionsPerBar
  const intervalDivisor = INTERVAL_CONFIG[interval].divisor

  // Calculate how many bars fit per row (1, 2, or 4 only)
  const barsPerRow = useMemo(() => {
    if (containerWidth === 0) return 1

    // Calculate minimum width needed for one bar
    // Each bar needs: string label width + (positionsPerBar * min cell width) + end bar line (2px)
    const minBarWidth = STRING_LABEL_WIDTH + positionsPerBar * MIN_CELL_WIDTH + 2

    // Calculate how many bars could fit with gaps
    // Available width for N bars: containerWidth >= N * minBarWidth + (N-1) * BAR_GAP
    const canFit = (n: number) => containerWidth >= n * minBarWidth + (n - 1) * BAR_GAP

    // Check in order: 4, 2, 1 (only valid options)
    if (canFit(4)) return 4
    if (canFit(2)) return 2
    return 1
  }, [containerWidth, positionsPerBar])

  // Group bars into rows
  const barRows = useMemo(() => {
    const rows: TabBar[][] = []
    for (let i = 0; i < bars.length; i += barsPerRow) {
      rows.push(bars.slice(i, i + barsPerRow))
    }
    return rows
  }, [bars, barsPerRow])

  // Calculate the original bar index from row and position in row
  const getBarIndex = (rowIndex: number, posInRow: number) => rowIndex * barsPerRow + posInRow

  // Handle interval change - clear all notes
  const handleIntervalChange = (newInterval: NoteInterval) => {
    setInterval(newInterval)
    // Clear all notes when changing interval
    setBars((prev) => prev.map((bar) => ({ ...bar, notes: [] })))
  }

  // Currently selected cell for editing
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null)
  const [inputValue, setInputValue] = useState("")

  // Get note at a specific position
  const getNoteAtPosition = useCallback(
    (barIndex: number, string: number, position: number): TabNote | undefined => {
      const bar = bars[barIndex]
      if (!bar) return undefined
      return bar.notes.find((note) => note.string === string && note.position === position)
    },
    [bars],
  )

  // Set note at a specific position
  const setNoteAtPosition = useCallback(
    (barIndex: number, string: number, position: number, fret: number | null) => {
      setBars((prevBars) => {
        const newBars = [...prevBars]
        const bar = { ...newBars[barIndex] }

        // Remove existing note at this position
        bar.notes = bar.notes.filter(
          (note) => !(note.string === string && note.position === position),
        )

        // Add new note if fret is valid
        if (fret !== null && fret >= 0 && fret <= 23) {
          bar.notes.push({ string, fret, position })
        }

        newBars[barIndex] = bar
        return newBars
      })
    },
    [],
  )

  // Handle cell click
  const handleCellClick = (barIndex: number, string: number, position: number) => {
    const existingNote = getNoteAtPosition(barIndex, string, position)
    setSelectedCell({ barIndex, string, position })
    setInputValue(existingNote?.fret?.toString() ?? "")
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    // Allow empty string or numbers 0-23
    if (value === "" || (/^\d{1,2}$/.test(value) && parseInt(value) <= 23)) {
      setInputValue(value)
    }
  }

  // Handle input blur or enter key
  const handleInputConfirm = () => {
    if (selectedCell) {
      const fret = inputValue === "" ? null : parseInt(inputValue)
      setNoteAtPosition(selectedCell.barIndex, selectedCell.string, selectedCell.position, fret)
      setSelectedCell(null)
      setInputValue("")
    }
  }

  // Handle key down in input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleInputConfirm()
    } else if (e.key === "Escape") {
      setSelectedCell(null)
      setInputValue("")
    }
  }

  // Add a new bar
  const addBar = () => {
    setBars((prev) => [...prev, createEmptyBar()])
  }

  // Remove a bar
  const removeBar = (barIndex: number) => {
    if (bars.length > 1) {
      setBars((prev) => prev.filter((_, i) => i !== barIndex))
    }
  }

  // Convert bars to NoteEvents for Tone.js scheduling
  const convertBarsToNoteEvents = useCallback((): NoteEvent[] => {
    const events: NoteEvent[] = []
    const currentInterval = intervalRef.current
    const currentBars = barsRef.current
    const currentPositionsPerBar = INTERVAL_CONFIG[currentInterval].positionsPerBar

    // Map interval to Tone.js note duration
    const noteDuration =
      currentInterval === "16th" ? "16n" : currentInterval === "32nd" ? "32n" : "64n"

    currentBars.forEach((bar, barIndex) => {
      bar.notes.forEach((note) => {
        // Calculate time in bars:beats:sixteenths format
        // For 4/4 time: position 0-15 for 16th notes maps to 4 beats
        const beatsPerBar = timeSignature[0]
        const positionsPerBeat = currentPositionsPerBar / beatsPerBar

        const beat = Math.floor(note.position / positionsPerBeat)
        const sixteenthsInBeat = (note.position % positionsPerBeat) * (4 / positionsPerBeat)

        events.push({
          id: `${bar.id}-${note.string}-${note.position}`,
          time: `${barIndex}:${beat}:${sixteenthsInBeat}`,
          string: note.string,
          fret: note.fret,
          duration: noteDuration,
          velocity: 0.8,
        })
      })
    })

    return events
  }, [timeSignature])

  // Start continuous position tracking using requestAnimationFrame
  const startPositionTracking = useCallback(() => {
    const updatePosition = () => {
      const position = Tone.getTransport().position as string
      const [bars, beats, sixteenths] = position.split(":").map(Number)

      // Calculate which bar we're in relative to the melody loop
      const totalMelodyBars = totalMelodyBarsRef.current
      const melodyBarIndex = bars % totalMelodyBars

      setCurrentBarIndex(melodyBarIndex)

      // Calculate position within the bar based on current interval
      const currentPosPerBar = INTERVAL_CONFIG[intervalRef.current].positionsPerBar
      const beatsPerBar = timeSignature[0]
      const positionsPerBeat = currentPosPerBar / beatsPerBar
      const positionInBar = Math.floor(
        beats * positionsPerBeat + sixteenths * (positionsPerBeat / 4),
      )
      setCurrentPosition(positionInBar)

      positionUpdateRef.current = requestAnimationFrame(updatePosition)
    }
    positionUpdateRef.current = requestAnimationFrame(updatePosition)
  }, [timeSignature])

  // Setup melody playback when player callbacks are triggered
  const setupMelodyPlayback = useCallback(() => {
    // Clean up existing part
    if (melodyPartRef.current) {
      melodyPartRef.current.stop()
      melodyPartRef.current.dispose()
      melodyPartRef.current = null
    }

    const events = convertBarsToNoteEvents()

    // Store total melody bars for position tracking
    const totalBars = barsRef.current.length
    totalMelodyBarsRef.current = totalBars

    // If no events, still start position tracking but don't create a part
    if (events.length === 0) {
      startPositionTracking()
      return
    }

    const partEvents = events.map((event) => ({
      time: event.time,
      event,
    }))

    melodyPartRef.current = new Tone.Part<{ time: string | number; event: NoteEvent }>(
      (time, value) => {
        const { event } = value
        playNote(event.string, event.fret, time, event.velocity || 0.8)
      },
      partEvents,
    )

    // Set loop to cover melody bars only - loops independently of chord line
    melodyPartRef.current.loop = true
    melodyPartRef.current.loopEnd = `${totalBars}:0:0`
    melodyPartRef.current.start(0)

    // Start continuous position tracking
    startPositionTracking()
  }, [convertBarsToNoteEvents, playNote, startPositionTracking])

  const cleanupMelodyPlayback = useCallback(() => {
    if (positionUpdateRef.current) {
      cancelAnimationFrame(positionUpdateRef.current)
      positionUpdateRef.current = null
    }
    if (melodyPartRef.current) {
      melodyPartRef.current.stop()
      melodyPartRef.current.dispose()
      melodyPartRef.current = null
    }
    setCurrentBarIndex(0)
    setCurrentPosition(0)
  }, [])

  // Register as a player to receive playback callbacks
  useEffect(() => {
    const callbacks: PlayerCallbacks = {
      onPlay: () => {
        setupMelodyPlayback()
      },
      onStop: () => {
        cleanupMelodyPlayback()
      },
      onPause: () => {
        // Stop position tracking on pause
        if (positionUpdateRef.current) {
          cancelAnimationFrame(positionUpdateRef.current)
          positionUpdateRef.current = null
        }
      },
      onResume: () => {
        // Resume position tracking
        startPositionTracking()
      },
      onBpmChange: () => {
        // BPM is handled by transport automatically
      },
    }

    registerPlayer(MELODY_PLAYER_ID, callbacks)

    return () => {
      unregisterPlayer(MELODY_PLAYER_ID)
      cleanupMelodyPlayback()
    }
  }, [
    registerPlayer,
    unregisterPlayer,
    setupMelodyPlayback,
    cleanupMelodyPlayback,
    startPositionTracking,
  ])

  // Check if there are any notes to play
  const hasNotes = bars.some((bar) => bar.notes.length > 0)

  const handleTogglePlayback = async () => {
    if (isPlaying) {
      stopPlayback()
    } else {
      if (hasNotes) {
        await startPlayback()
      }
    }
  }

  const handleStop = () => {
    stopPlayback()
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Melody Editor</h1>
        <div className="flex items-center gap-4">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleTogglePlayback}
              disabled={!hasNotes}
            >
              {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleStop}
              disabled={!isPlaying && currentBarIndex === 0}
            >
              <SquareIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="bg-border h-6 w-px" />

          {/* Interval Selection */}
          <div className="flex items-center gap-2">
            <Button
              variant={interval === "16th" ? "default" : "outline"}
              size="sm"
              onClick={() => handleIntervalChange("16th")}
              disabled={isPlaying}
            >
              16th
            </Button>
            <Button
              variant={interval === "32nd" ? "default" : "outline"}
              size="sm"
              onClick={() => handleIntervalChange("32nd")}
              disabled={isPlaying}
            >
              32nd
            </Button>
            <Button
              variant={interval === "64th" ? "default" : "outline"}
              size="sm"
              onClick={() => handleIntervalChange("64th")}
              disabled={isPlaying}
            >
              64th
            </Button>
          </div>

          <div className="bg-border h-6 w-px" />

          <Button variant="outline" size="sm" onClick={addBar} disabled={isPlaying}>
            Add Bar
          </Button>
        </div>
      </div>

      {/* Responsive container for bars */}
      <div ref={containerRef} className="space-y-6 rounded-lg border p-4">
        {barRows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${barsPerRow}, 1fr)` }}
          >
            {row.map((bar, posInRow) => {
              const barIndex = getBarIndex(rowIndex, posInRow)
              return (
                <div
                  key={bar.id}
                  className="min-w-0" // Allow grid item to shrink below content size
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-muted-foreground text-sm font-medium">
                      Bar {barIndex + 1}
                    </span>
                    {bars.length > 1 && !isPlaying && (
                      <button
                        onClick={() => removeBar(barIndex)}
                        className="text-destructive hover:text-destructive/80 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Tab Grid */}
                  <div className="w-full">
                    {/* String rows */}
                    {Array.from({ length: 6 }).map((_, stringIndex) => (
                      <div key={stringIndex} className="flex items-center">
                        {/* String label */}
                        <div className="text-muted-foreground w-5 shrink-0 pr-2 text-right font-mono text-sm">
                          {STANDARD_TUNING_NOTES[stringIndex]}
                        </div>

                        {/* String line with cells */}
                        <div className="relative flex flex-1">
                          {/* Horizontal line representing the string */}
                          <div className="bg-border absolute top-1/2 right-0 left-0 h-px" />

                          {/* Position cells */}
                          {Array.from({ length: positionsPerBar }).map((_, posIndex) => {
                            const note = getNoteAtPosition(barIndex, stringIndex, posIndex)
                            const isSelected =
                              selectedCell?.barIndex === barIndex &&
                              selectedCell?.string === stringIndex &&
                              selectedCell?.position === posIndex
                            // Beat markers: every 4 positions for 16th, 8 for 32nd, 16 for 64th
                            const isBeatMarker = posIndex % intervalDivisor === 0
                            // Highlight current playback position
                            const isCurrentPosition =
                              isPlaying &&
                              barIndex === currentBarIndex &&
                              posIndex === currentPosition

                            return (
                              <div
                                key={posIndex}
                                className={`relative flex h-4 min-w-3 flex-1 cursor-pointer items-center justify-center ${
                                  isBeatMarker ? "border-muted-foreground/30 border-l" : ""
                                } ${isCurrentPosition ? "bg-primary/20" : ""}`}
                                onClick={() =>
                                  !isPlaying && handleCellClick(barIndex, stringIndex, posIndex)
                                }
                              >
                                {isSelected ? (
                                  <input
                                    type="text"
                                    value={inputValue}
                                    onChange={handleInputChange}
                                    onBlur={handleInputConfirm}
                                    onKeyDown={handleKeyDown}
                                    className="border-primary bg-background focus:ring-primary absolute top-1/2 left-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded border text-center font-mono text-xs focus:ring-1 focus:outline-none"
                                    autoFocus
                                    maxLength={2}
                                  />
                                ) : note ? (
                                  <span
                                    className={`absolute top-1/2 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded font-mono text-xs ${
                                      isCurrentPosition
                                        ? "bg-green-500 text-white"
                                        : "bg-primary text-primary-foreground"
                                    }`}
                                  >
                                    {note.fret}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/30 text-xs">-</span>
                                )}
                              </div>
                            )
                          })}

                          {/* End bar line */}
                          <div className="border-muted-foreground/50 h-4 shrink-0 border-r" />
                        </div>
                      </div>
                    ))}

                    {/* Position markers (beat numbers based on interval) */}
                    <div className="flex">
                      <div className="w-5 shrink-0" />
                      <div className="flex flex-1">
                        {Array.from({ length: positionsPerBar }).map((_, posIndex) => (
                          <div
                            key={posIndex}
                            className="text-muted-foreground flex h-4 min-w-3 flex-1 items-center justify-center text-[10px]"
                          >
                            {posIndex % intervalDivisor === 0 ? posIndex / intervalDivisor + 1 : ""}
                          </div>
                        ))}
                        {/* Spacer to match end bar line */}
                        <div className="w-px shrink-0" />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
