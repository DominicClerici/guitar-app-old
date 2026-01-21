"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useNoteDetection } from "@/hooks/useNoteDetection"
import { freqToMidi, STRING_OPEN_MIDI } from "@/lib/audio/utils"
import {
  ALL_KEYS,
  CAGED_SHAPE_NAMES,
  getCAGEDShapeNotes,
  getMajorScale,
  getNoteName,
  type CAGEDShapeName,
  type ScaleNote,
} from "@/lib/scales/major-scale"

type ViewMode = "full" | CAGEDShapeName
type PracticeState = "idle" | "countdown" | "practicing" | "between-shapes" | "complete"

export default function ScalesPracticeClient() {
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(0)
  const [showDegrees, setShowDegrees] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("full")

  const [practiceState, setPracticeState] = useState<PracticeState>("idle")
  const [countdownValue, setCountdownValue] = useState(3)
  const [currentShapeIndex, setCurrentShapeIndex] = useState(0)
  const [playedNoteKeys, setPlayedNoteKeys] = useState<Set<string>>(new Set())

  const practiceStateRef = useRef(practiceState)
  const currentShapeNotesRef = useRef<ScaleNote[]>([])
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    practiceStateRef.current = practiceState
  }, [practiceState])

  const fullScale = getMajorScale(selectedKeyIndex)
  const currentShapeName = CAGED_SHAPE_NAMES[currentShapeIndex]
  const currentShapeNotes = getCAGEDShapeNotes(currentShapeName, fullScale, selectedKeyIndex)

  useEffect(() => {
    currentShapeNotesRef.current = currentShapeNotes
  }, [currentShapeNotes])

  const getNoteKey = (stringIndex: number, fretIndex: number) => `${stringIndex}-${fretIndex}`

  const getMidiForPosition = (stringIndex: number, fretIndex: number) =>
    STRING_OPEN_MIDI[stringIndex] + fretIndex

  const handlePitchDetected = useCallback(({ pitch }: { pitch: number; clarity: number }) => {
    if (practiceStateRef.current !== "practicing" || pitch <= 0) return

    const detectedMidi = Math.round(freqToMidi(pitch))

    const shapeNotes = currentShapeNotesRef.current
    const matchingNotes = shapeNotes.filter(
      (note) => getMidiForPosition(note.stringIndex, note.fretIndex) === detectedMidi,
    )

    if (matchingNotes.length > 0) {
      setPlayedNoteKeys((prev) => {
        const next = new Set(prev)
        for (const note of matchingNotes) {
          next.add(getNoteKey(note.stringIndex, note.fretIndex))
        }
        return next
      })
    }
  }, [])

  const { startListening, stopListening } = useNoteDetection({
    onPitchDetected: handlePitchDetected,
    minClarity: 0.85,
  })

  const allNotesPlayed =
    currentShapeNotes.length > 0 &&
    currentShapeNotes.every((note) =>
      playedNoteKeys.has(getNoteKey(note.stringIndex, note.fretIndex)),
    )

  useEffect(() => {
    if (practiceState !== "practicing" || !allNotesPlayed) return

    setPracticeState("between-shapes")

    transitionTimerRef.current = setTimeout(() => {
      const nextIndex = currentShapeIndex + 1
      if (nextIndex >= CAGED_SHAPE_NAMES.length) {
        setPracticeState("complete")
        stopListening()
      } else {
        setCurrentShapeIndex(nextIndex)
        setPlayedNoteKeys(new Set())
        setPracticeState("practicing")
      }
    }, 2000)
  }, [practiceState, allNotesPlayed, currentShapeIndex, stopListening])

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
    }
  }, [])

  const startPractice = async () => {
    setPracticeState("countdown")
    setCountdownValue(3)
    setCurrentShapeIndex(0)
    setPlayedNoteKeys(new Set())

    await startListening()

    let count = 3
    const interval = setInterval(() => {
      count--
      if (count === 0) {
        clearInterval(interval)
        setPracticeState("practicing")
      } else {
        setCountdownValue(count)
      }
    }, 1000)
  }

  const cancelPractice = () => {
    setPracticeState("idle")
    stopListening()
    setPlayedNoteKeys(new Set())
  }

  const isPracticing = practiceState !== "idle"

  const displayNotes = isPracticing
    ? currentShapeNotes
    : viewMode === "full"
      ? fullScale
      : getCAGEDShapeNotes(viewMode, fullScale, selectedKeyIndex)

  const markers: Marker[] = displayNotes.map((note) => {
    const noteKey = getNoteKey(note.stringIndex, note.fretIndex)
    const isPlayed = playedNoteKeys.has(noteKey)

    let type: Marker["type"]
    if (isPracticing && isPlayed) {
      type = "played"
    } else if (note.degree === 1) {
      type = "root"
    } else {
      type = "note"
    }

    return {
      stringIndex: note.stringIndex,
      fretIndex: note.fretIndex,
      type,
      label: getNoteName(note.noteIndex),
      degree: note.degree,
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Key:</span>
          <Select
            value={String(selectedKeyIndex)}
            onValueChange={(value) => setSelectedKeyIndex(Number(value))}
            disabled={isPracticing}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_KEYS.map((key) => (
                <SelectItem key={key.noteIndex} value={String(key.noteIndex)}>
                  {key.name} Major
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isPracticing && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">View:</span>
              <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Neck</SelectItem>
                  {CAGED_SHAPE_NAMES.map((shape) => (
                    <SelectItem key={shape} value={shape}>
                      {shape} Shape
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Show degrees:</span>
              <Switch checked={showDegrees} onCheckedChange={setShowDegrees} />
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {!isPracticing ? (
            <Button onClick={startPractice}>Practice</Button>
          ) : (
            <Button variant="outline" onClick={cancelPractice}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {practiceState === "countdown" && (
        <div className="flex items-center justify-center py-8">
          <span className="text-6xl font-bold">{countdownValue}</span>
        </div>
      )}

      {practiceState === "practicing" && (
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-sm">
            Shape: <span className="text-foreground font-medium">{currentShapeName}</span>
          </span>
          <span className="text-muted-foreground text-sm">
            Progress:{" "}
            <span className="text-foreground font-medium">
              {playedNoteKeys.size} / {currentShapeNotes.length}
            </span>
          </span>
        </div>
      )}

      {practiceState === "between-shapes" && (
        <div className="flex items-center justify-center py-4">
          <span className="text-muted-foreground text-lg">
            {currentShapeName} shape complete! Next shape loading...
          </span>
        </div>
      )}

      {practiceState === "complete" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <span className="text-lg font-medium">All shapes completed!</span>
          <Button onClick={cancelPractice}>Done</Button>
        </div>
      )}

      {practiceState !== "countdown" && (
        <Fretboard markers={markers} showDegree={showDegrees && !isPracticing} className="w-full" />
      )}
    </div>
  )
}
