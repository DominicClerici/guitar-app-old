"use client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PauseIcon, PlayIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import * as Tone from "tone"
import useFretboardContext, { PlayerCallbacks } from "../fretboard/fretboard-context"

const TAB_PLAYER_ID = "tab-player"

// Note interval options (subdivisions per beat)
export type NoteInterval = "16th" | "32nd" | "64th"

const INTERVAL_CONFIG: Record<NoteInterval, { positionsPerBar: number; divisor: number }> = {
  "16th": { positionsPerBar: 16, divisor: 4 }, // 4 16th notes per beat, 16 per bar in 4/4
  "32nd": { positionsPerBar: 32, divisor: 8 }, // 8 32nd notes per beat, 32 per bar in 4/4
  "64th": { positionsPerBar: 64, divisor: 16 }, // 16 64th notes per beat, 64 per bar in 4/4
}

// Data structure for a single note in the tab
export type TabNote = {
  string: number // 0-5 (0 = high E, 5 = low E)
  fret: number // 0-23
  position: number // 0-31 (position within the bar, represents 32nd note intervals)
}

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

// String labels for display (from high E to low E)
const STRING_LABELS = ["e", "B", "G", "D", "A", "E"]

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

export default function TabPlayer() {
  const {
    tuning,
    playNote,
    releaseAllStrings,
    // Centralized playback
    playbackState,
    bpm,
    setBpm,
    registerPlayer,
    unregisterPlayer,
    startPlayback,
    stopPlayback: contextStopPlayback,
  } = useFretboardContext()

  // Tab state
  const [bars, setBars] = useState<TabBar[]>([createEmptyBar()])
  const [interval, setInterval] = useState<NoteInterval>("32nd")
  const isPlaying = playbackState === "playing"

  // Get positions per bar based on current interval
  const positionsPerBar = INTERVAL_CONFIG[interval].positionsPerBar
  const intervalDivisor = INTERVAL_CONFIG[interval].divisor

  // Handle interval change - clear all notes
  const handleIntervalChange = (newInterval: NoteInterval) => {
    setInterval(newInterval)
    // Clear all notes when changing interval
    setBars((prev) => prev.map((bar) => ({ ...bar, notes: [] })))
  }

  // Playback state
  const [currentPosition, setCurrentPosition] = useState<{ bar: number; position: number } | null>(
    null,
  )
  const scheduledEventsRef = useRef<number[]>([])
  const playbackTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const playbackStartTimeRef = useRef<number>(0)

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

  // Calculate duration of one position (note interval) in seconds based on BPM
  // BPM = quarter notes per minute
  // The divisor determines how many of these notes fit in a quarter note
  const getIntervalDuration = useCallback(() => {
    const quarterNoteDuration = 60 / bpm // seconds per quarter note
    return quarterNoteDuration / intervalDivisor
  }, [bpm, intervalDivisor])

  // Internal function to clean up tab playback
  const cleanupTabPlayback = useCallback(() => {
    // Clear all scheduled transport events
    scheduledEventsRef.current.forEach((eventId) => {
      Tone.getTransport().clear(eventId)
    })
    scheduledEventsRef.current = []

    // Clear the end timeout
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current)
      playbackTimeoutRef.current = null
    }

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    setCurrentPosition(null)
  }, [])

  // Internal function to set up tab playback (called when centralized playback starts)
  const setupTabPlayback = useCallback(
    (startTime: number) => {
      // Clean up any existing playback
      cleanupTabPlayback()

      const noteDuration = getIntervalDuration()
      playbackStartTimeRef.current = startTime

      // Schedule all notes across all bars
      bars.forEach((bar, barIndex) => {
        bar.notes.forEach((note) => {
          // Calculate the absolute time for this note
          const positionInBar = note.position
          const absolutePosition = barIndex * positionsPerBar + positionInBar
          const noteTime = startTime + absolutePosition * noteDuration

          // Find the next note on the same string to calculate duration
          // Look in current bar and subsequent bars
          let nextNotePosition: number | null = null
          for (let bi = barIndex; bi < bars.length; bi++) {
            const searchBar = bars[bi]
            for (const otherNote of searchBar.notes) {
              if (otherNote.string === note.string) {
                const otherAbsolutePos = bi * positionsPerBar + otherNote.position
                if (otherAbsolutePos > absolutePosition) {
                  if (nextNotePosition === null || otherAbsolutePos < nextNotePosition) {
                    nextNotePosition = otherAbsolutePos
                  }
                }
              }
            }
          }

          // Calculate note duration - either until next note on same string or a default
          let duration: number
          if (nextNotePosition !== null) {
            duration = (nextNotePosition - absolutePosition) * noteDuration
          } else {
            // Default duration: let it ring for 2 beats (8 64th notes)
            duration = noteDuration * 16
          }

          // Schedule the note with calculated duration
          playNote(note.string, note.fret, noteTime, duration)
        })
      })

      // Calculate total playback duration
      const totalPositions = bars.length * positionsPerBar
      const totalDuration = totalPositions * noteDuration * 1000 // Convert to ms

      // Use requestAnimationFrame-based position tracking for smoother updates
      const updatePosition = () => {
        if (!playbackTimeoutRef.current) return
        const elapsed = (Tone.now() - startTime) * 1000
        const currentPos = Math.floor(elapsed / (noteDuration * 1000))
        const barIndex = Math.floor(currentPos / positionsPerBar)
        const posInBar = currentPos % positionsPerBar

        if (barIndex < bars.length) {
          setCurrentPosition({ bar: barIndex, position: posInBar })
          animationFrameRef.current = requestAnimationFrame(updatePosition)
        }
      }
      animationFrameRef.current = requestAnimationFrame(updatePosition)

      // Schedule end of playback (stop the centralized playback)
      playbackTimeoutRef.current = setTimeout(() => {
        contextStopPlayback()
        playbackTimeoutRef.current = null
      }, totalDuration + 500) // Add a small buffer for note release
    },
    [bars, getIntervalDuration, playNote, positionsPerBar, cleanupTabPlayback, contextStopPlayback]
  )

  // Register player callbacks with the centralized playback system
  useEffect(() => {
    const callbacks: PlayerCallbacks = {
      onPlay: (startTime) => {
        setupTabPlayback(startTime)
      },
      onStop: () => {
        cleanupTabPlayback()
        releaseAllStrings()
      },
      onPause: () => {
        // Cancel the animation frame when paused
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
      },
      onResume: () => {
        // Resume position tracking
        const noteDuration = getIntervalDuration()
        const startTime = playbackStartTimeRef.current

        const updatePosition = () => {
          if (!playbackTimeoutRef.current) return
          const elapsed = (Tone.now() - startTime) * 1000
          const currentPos = Math.floor(elapsed / (noteDuration * 1000))
          const barIndex = Math.floor(currentPos / positionsPerBar)
          const posInBar = currentPos % positionsPerBar

          if (barIndex < bars.length) {
            setCurrentPosition({ bar: barIndex, position: posInBar })
            animationFrameRef.current = requestAnimationFrame(updatePosition)
          }
        }
        animationFrameRef.current = requestAnimationFrame(updatePosition)
      },
      onBpmChange: () => {
        // BPM changes are handled by the transport automatically
      },
    }

    registerPlayer(TAB_PLAYER_ID, callbacks)

    return () => {
      unregisterPlayer(TAB_PLAYER_ID)
      cleanupTabPlayback()
    }
  }, [
    registerPlayer,
    unregisterPlayer,
    setupTabPlayback,
    cleanupTabPlayback,
    releaseAllStrings,
    getIntervalDuration,
    positionsPerBar,
    bars.length,
  ])

  const handlePlayStop = async () => {
    if (isPlaying) {
      contextStopPlayback()
    } else {
      await startPlayback()
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-24">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tab Editor</h1>
        <div className="flex items-center gap-4">
          {/* Playback controls */}
          <div className="flex items-center gap-2">
            {!isPlaying ? (
              <button
                onClick={handlePlayStop}
                className="flex items-center gap-1.5 rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                <PlayIcon className="h-4 w-4" />
                Play
              </button>
            ) : (
              <button
                onClick={handlePlayStop}
                className="flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                <PauseIcon className="h-4 w-4" />
                Stop
              </button>
            )}
          </div>

          <label className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">BPM:</span>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Math.max(20, Math.min(300, parseInt(e.target.value) || 120)))}
              className="border-border bg-background w-16 rounded border px-2 py-1 text-center text-sm"
              min={20}
              max={300}
              disabled={isPlaying}
            />
          </label>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Interval:</span>
            <Select
              value={interval}
              onValueChange={(value) => handleIntervalChange(value as NoteInterval)}
              disabled={isPlaying}
            >
              <SelectTrigger className="w-24" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16th">16th</SelectItem>
                <SelectItem value="32nd">32nd</SelectItem>
                <SelectItem value="64th">64th</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={addBar}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1.5 text-sm font-medium"
            disabled={isPlaying}
          >
            Add Bar
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {bars.map((bar, barIndex) => (
          <div key={bar.id} className="border-border bg-card rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted-foreground text-sm font-medium">Bar {barIndex + 1}</span>
              {bars.length > 1 && (
                <button
                  onClick={() => removeBar(barIndex)}
                  className="text-destructive hover:text-destructive/80 text-sm"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Tab Grid */}
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                {/* String rows */}
                {Array.from({ length: 6 }).map((_, stringIndex) => (
                  <div key={stringIndex} className="flex items-center">
                    {/* String label */}
                    <div className="text-muted-foreground w-5 shrink-0 pr-2 text-right font-mono text-sm">
                      {STRING_LABELS[stringIndex]}
                    </div>

                    {/* String line with cells */}
                    <div className="relative flex">
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
                        const isPlaybackPosition =
                          currentPosition?.bar === barIndex &&
                          currentPosition?.position === posIndex

                        return (
                          <div
                            key={posIndex}
                            className={`relative flex h-5 w-4.5 cursor-pointer items-center justify-center ${
                              isBeatMarker ? "border-muted-foreground/30 border-l" : ""
                            } ${isPlaybackPosition ? "bg-green-500/20" : ""}`}
                            onClick={() =>
                              !isPlaying && handleCellClick(barIndex, stringIndex, posIndex)
                            }
                          >
                            {isSelected && !isPlaying ? (
                              <input
                                type="text"
                                value={inputValue}
                                onChange={handleInputChange}
                                onBlur={handleInputConfirm}
                                onKeyDown={handleKeyDown}
                                className="border-primary bg-background focus:ring-primary absolute z-10 h-5 w-4.5 rounded border text-center font-mono text-xs focus:ring-1 focus:outline-none"
                                autoFocus
                                maxLength={2}
                              />
                            ) : note ? (
                              <span
                                className={`relative z-10 rounded px-1 font-mono text-xs ${
                                  isPlaybackPosition
                                    ? "bg-green-600 text-white"
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
                      <div className="border-muted-foreground/50 h-6 border-r" />
                    </div>
                  </div>
                ))}

                {/* Position markers (beat numbers based on interval) */}
                <div className="mt-1 flex">
                  <div className="w-5 shrink-0" />
                  {Array.from({ length: positionsPerBar }).map((_, posIndex) => (
                    <div
                      key={posIndex}
                      className="text-muted-foreground flex h-4 w-5 items-center justify-center text-[10px]"
                    >
                      {posIndex % intervalDivisor === 0 ? posIndex / intervalDivisor + 1 : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Debug info for tuning context verification */}
      <div className="text-muted-foreground mt-8 text-xs">
        <p>Current tuning offset: [{tuning.join(", ")}]</p>
        <p>Total notes in tab: {bars.reduce((sum, bar) => sum + bar.notes.length, 0)}</p>
      </div>
    </div>
  )
}
