"use client"

import { Fretboard, type Marker, type MarkerType } from "@/components/fretboard/fretboard"
import { Button } from "@/components/ui/button"
import { useNoteDetection } from "@/hooks/useNoteDetection"
import { NOTE_NAMES, type NoteName } from "@/lib/audio/utils"
import { SCALE_NAMES, type ScaleType } from "@/lib/constants"
import {
  convertToAeolian,
  convertToDorian,
  convertToLocrian,
  convertToLydian,
  convertToMajorPentatonic,
  convertToMinor,
  convertToMinorPentatonic,
  convertToMixolydian,
  convertToPhrygian,
  getMajorScale,
  getShapeNotes,
  type ScaleNote,
} from "@/lib/scales/major-scale"
import { cn } from "@/lib/utils"
import { Mic, MicOff, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

function isFrequencyMatch(detected: number, target: number, tolerance: number = 0.02): boolean {
  if (detected <= 0) return false
  const lowerBound = target * (1 - tolerance)
  const upperBound = target * (1 + tolerance)
  return detected >= lowerBound && detected <= upperBound
}

function createNoteKey(stringIndex: number, fretIndex: number): string {
  return `${stringIndex}-${fretIndex}`
}

function scaleNotesToMarkers(
  notes: ScaleNote[],
  playedNotes: Set<string>,
  showNotes: boolean,
): Marker[] {
  return notes.map((note) => {
    const key = createNoteKey(note.stringIndex, note.fretIndex)
    const isPlayed = playedNotes.has(key)
    const isRoot = note.degree === 1

    let type: MarkerType
    if (isPlayed) {
      type = isRoot ? "root" : "note"
    } else if (showNotes) {
      type = isRoot ? "root-disabled" : "note-disabled"
    } else {
      type = isRoot ? "root-hidden" : "note-hidden"
    }

    return {
      stringIndex: note.stringIndex,
      fretIndex: note.fretIndex,
      type,
      label: NOTE_NAMES[note.noteIndex],
    }
  })
}

type ScalePracticeShape = {
  shapeIndex: number
  duration: number
  key: NoteName
  scale: ScaleType
  showNotes: boolean
  noteCount: number
  fretRange: [number, number]
}

type ScalePracticeSession = {
  startTime: number
  endTime: number
  showNotes: boolean
  scale: ScaleType
  shapes: ScalePracticeShape[]
}

type DerivedSessionStats = {
  totalShapes: number
  totalNotes: number
  totalDurationSeconds: number
  shapesPerMinute: number
  notesPerSecond: number
  slowestShape: { shapeIndex: number; fretRange: [number, number]; duration: number } | null
  fastestShape: { shapeIndex: number; fretRange: [number, number]; duration: number } | null
}

function deriveSessionStats(session: ScalePracticeSession): DerivedSessionStats {
  const shapes = session.shapes
  const totalShapes = shapes.length
  const totalDurationSeconds = (session.endTime - session.startTime) / 1000
  const totalNotes = shapes.reduce((sum, s) => sum + s.noteCount, 0)

  const shapesPerMinute = totalDurationSeconds > 0 ? (totalShapes / totalDurationSeconds) * 60 : 0
  const notesPerSecond = totalDurationSeconds > 0 ? totalNotes / totalDurationSeconds : 0

  let slowestShape: DerivedSessionStats["slowestShape"] = null
  let fastestShape: DerivedSessionStats["fastestShape"] = null

  for (const shape of shapes) {
    const shapeData = {
      shapeIndex: shape.shapeIndex,
      fretRange: shape.fretRange as [number, number],
      duration: shape.duration,
    }
    if (!slowestShape || shape.duration > slowestShape.duration) slowestShape = shapeData
    if (!fastestShape || shape.duration < fastestShape.duration) fastestShape = shapeData
  }

  return {
    totalShapes,
    totalNotes,
    totalDurationSeconds,
    shapesPerMinute,
    notesPerSecond,
    slowestShape,
    fastestShape,
  }
}

const SHAPE_COMPLETION_DELAY_MS = 1000
const TOTAL_SHAPES = 5
const COUNTDOWN_START = 4
const DEFAULT_DURATION_MS = 120 * 1000

type SessionState = "idle" | "countdown" | "active" | "finished"

export default function ScaleTrainerPage() {
  // Selection state
  const [selectedScale, setSelectedScale] = useState<ScaleType | null>(null)
  const [selectedKey, setSelectedKey] = useState<NoteName | null>(null)
  const [showNotes, setShowNotes] = useState(true)

  // Session state
  const [sessionState, setSessionState] = useState<SessionState>("idle")
  const [countdown, setCountdown] = useState(COUNTDOWN_START)
  const [remainingMs, setRemainingMs] = useState(DEFAULT_DURATION_MS)
  const [shapeIndex, setShapeIndex] = useState(0)
  const [playedNotes, setPlayedNotes] = useState<Set<string>>(new Set())
  const [sessionStats, setSessionStats] = useState<DerivedSessionStats | null>(null)

  const sessionRef = useRef<ScalePracticeSession | null>(null)
  const shapeStartTimeRef = useRef<number>(0)
  const isTransitioningRef = useRef(false)

  const {
    status: micStatus,
    pitch,
    startListening,
    stopListening,
  } = useNoteDetection({
    minClarity: 0.9,
    updateIntervalMs: 50,
    bufferSize: 2048,
  })

  const isListening = micStatus === "recording"

  const rootNoteIndex = useMemo(() => {
    if (!selectedKey) return 9 // Default to A
    const index = NOTE_NAMES.indexOf(selectedKey)
    return index >= 0 ? index : 9
  }, [selectedKey])

  const fullScale = useMemo(() => {
    if (!selectedScale) return getMajorScale(rootNoteIndex)

    const majorScale = getMajorScale(rootNoteIndex)
    switch (selectedScale) {
      case "minor":
        return convertToMinor(majorScale)
      case "dorian":
        return convertToDorian(majorScale)
      case "phrygian":
        return convertToPhrygian(majorScale)
      case "lydian":
        return convertToLydian(majorScale)
      case "mixolydian":
        return convertToMixolydian(majorScale)
      case "aeolian":
        return convertToAeolian(majorScale)
      case "locrian":
        return convertToLocrian(majorScale)
      case "majorPentatonic":
        return convertToMajorPentatonic(majorScale)
      case "minorPentatonic":
        return convertToMinorPentatonic(majorScale)
      default:
        return majorScale
    }
  }, [rootNoteIndex, selectedScale])

  const shapeNotes = useMemo(() => getShapeNotes(shapeIndex, fullScale), [shapeIndex, fullScale])

  const markers = useMemo(
    () => scaleNotesToMarkers(shapeNotes, playedNotes, showNotes),
    [shapeNotes, playedNotes, showNotes],
  )

  const selectRandomShape = useCallback(
    (isFirst = false) => {
      let newIndex = Math.floor(Math.random() * TOTAL_SHAPES)
      if (!isFirst) {
        while (newIndex === shapeIndex) {
          newIndex = Math.floor(Math.random() * TOTAL_SHAPES)
        }
      }
      setShapeIndex(newIndex)
      setPlayedNotes(new Set())
      isTransitioningRef.current = false
      shapeStartTimeRef.current = Date.now()
    },
    [shapeIndex, fullScale],
  )

  const finalizeCurrentShape = useCallback(() => {
    if (!sessionRef.current || !selectedScale || !selectedKey) return
    const now = Date.now()
    const shapeDuration = now - shapeStartTimeRef.current
    const frets = shapeNotes.map((n) => n.fretIndex)
    const completedShape: ScalePracticeShape = {
      shapeIndex,
      duration: shapeDuration,
      key: selectedKey,
      scale: selectedScale,
      showNotes,
      noteCount: shapeNotes.length,
      fretRange: [Math.min(...frets), Math.max(...frets)],
    }
    sessionRef.current.shapes.push(completedShape)
  }, [shapeIndex, shapeNotes, selectedKey, selectedScale, showNotes])

  const finalizeSession = useCallback(() => {
    if (!sessionRef.current) return
    sessionRef.current.endTime = Date.now()
    const stats = deriveSessionStats(sessionRef.current)
    console.log("=== Scale Practice Session Complete ===")
    console.log("Session:", sessionRef.current)
    console.log("Stats:", stats)
    setSessionStats(stats)
    setSessionState("finished")
    stopListening()
  }, [stopListening])

  const startSession = useCallback(async () => {
    if (!selectedScale || !selectedKey) return

    await startListening()
    selectRandomShape(true)
    setCountdown(COUNTDOWN_START)
    setRemainingMs(DEFAULT_DURATION_MS)
    setSessionStats(null)
    setSessionState("countdown")
  }, [selectedScale, selectedKey, startListening, selectRandomShape])

  const cancelSession = useCallback(() => {
    stopListening()
    setSessionState("idle")
    setPlayedNotes(new Set())
    sessionRef.current = null
  }, [stopListening])

  useEffect(() => {
    if (sessionState !== "countdown") return
    if (countdown <= 0) {
      const now = Date.now()
      sessionRef.current = {
        startTime: now,
        endTime: 0,
        showNotes,
        scale: selectedScale!,
        shapes: [],
      }
      shapeStartTimeRef.current = now
      setSessionState("active")
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [sessionState, countdown, showNotes, selectedScale])

  useEffect(() => {
    if (sessionState !== "active") return
    if (remainingMs <= 0) {
      finalizeSession()
      return
    }
    const timer = setTimeout(() => setRemainingMs((r) => r - 1000), 1000)
    return () => clearTimeout(timer)
  }, [sessionState, remainingMs, finalizeSession])

  useEffect(() => {
    if (sessionState !== "active" || pitch <= 0 || isTransitioningRef.current) return

    for (const note of shapeNotes) {
      const noteKey = createNoteKey(note.stringIndex, note.fretIndex)
      if (playedNotes.has(noteKey)) continue

      if (isFrequencyMatch(pitch, note.targetFrequency)) {
        setPlayedNotes((prev) => new Set(prev).add(noteKey))
        break
      }
    }
  }, [sessionState, pitch, shapeNotes, playedNotes])

  useEffect(() => {
    if (sessionState !== "active") return
    if (playedNotes.size === 0 || playedNotes.size < shapeNotes.length) return

    isTransitioningRef.current = true
    finalizeCurrentShape()
    const timeout = setTimeout(() => selectRandomShape(), SHAPE_COMPLETION_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [sessionState, playedNotes.size, shapeNotes.length, finalizeCurrentShape, selectRandomShape])

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const canStart = selectedScale && selectedKey

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div
        className={cn(
          "border-border space-y-6 border-b p-6 transition-opacity",
          sessionState !== "idle" && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-foreground text-2xl font-bold">Scale Trainer</h1>
          {sessionState !== "idle" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={cancelSession}
              className="pointer-events-auto opacity-100"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-muted-foreground text-sm font-medium">Scale</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SCALE_NAMES) as ScaleType[]).map((scale) => (
              <Button
                key={scale}
                variant={selectedScale === scale ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedScale(selectedScale === scale ? null : scale)}
              >
                {SCALE_NAMES[scale]}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-muted-foreground text-sm font-medium">Key</label>
          <div className="flex flex-wrap gap-2">
            {NOTE_NAMES.map((note) => (
              <Button
                key={note}
                variant={selectedKey === note ? "default" : "outline"}
                size="sm"
                className="w-12"
                onClick={() => setSelectedKey(selectedKey === note ? null : note)}
              >
                {note}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant={showNotes ? "default" : "outline"}
            size="sm"
            onClick={() => setShowNotes(!showNotes)}
          >
            {showNotes ? "Notes Visible" : "Notes Hidden"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={isListening ? stopListening : startListening}
          >
            {isListening ? (
              <>
                <Mic className="mr-2 h-4 w-4" />
                Mic On
              </>
            ) : (
              <>
                <MicOff className="mr-2 h-4 w-4" />
                Mic Off
              </>
            )}
          </Button>
        </div>

        <div className="bg-card border-border rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-foreground text-lg font-semibold">
                {selectedScale
                  ? selectedKey
                    ? `${selectedKey} ${SCALE_NAMES[selectedScale]}`
                    : "Select a key"
                  : "Select a scale"}
              </p>
              <p className="text-muted-foreground text-sm">
                Practice random CAGED shapes with pitch detection
              </p>
            </div>
            <Button size="lg" disabled={!canStart} onClick={startSession}>
              Start Practice
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-6">
        {sessionState === "countdown" && (
          <div className="flex flex-col items-center justify-center">
            <span className="text-foreground text-9xl font-bold">{countdown}</span>
            <p className="text-muted-foreground mt-4 text-lg">Get ready...</p>
          </div>
        )}

        {sessionState === "active" && (
          <div className="flex w-full max-w-4xl flex-col items-center gap-6">
            <div className="text-foreground text-4xl font-semibold tabular-nums">
              {formatTime(remainingMs)}
            </div>

            <div className="w-full">
              <Fretboard markers={markers} />
            </div>
            <div className="text-muted-foreground text-sm">
              Shape {shapeIndex + 1} of {TOTAL_SHAPES} • {playedNotes.size} / {shapeNotes.length}{" "}
              notes
            </div>
          </div>
        )}

        {sessionState === "finished" && sessionStats && (
          <div className="bg-card border-border max-w-md rounded-lg border p-6">
            <h2 className="text-foreground mb-4 text-2xl font-bold">Session Complete</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Time</span>
                <span className="text-foreground font-medium">
                  {formatTime(sessionStats.totalDurationSeconds * 1000)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shapes Completed</span>
                <span className="text-foreground font-medium">{sessionStats.totalShapes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notes Played</span>
                <span className="text-foreground font-medium">{sessionStats.totalNotes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shapes/Minute</span>
                <span className="text-foreground font-medium">
                  {sessionStats.shapesPerMinute.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notes/Second</span>
                <span className="text-foreground font-medium">
                  {sessionStats.notesPerSecond.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button
                className="flex-1"
                onClick={() => {
                  setSessionState("idle")
                  setPlayedNotes(new Set())
                }}
              >
                Done
              </Button>
              <Button variant="outline" className="flex-1" onClick={startSession}>
                Practice Again
              </Button>
            </div>
          </div>
        )}

        {sessionState === "idle" && (
          <div className="flex w-full max-w-4xl flex-col items-center gap-4">
            {canStart ? (
              <>
                <p className="text-muted-foreground text-center">
                  Preview: {selectedKey} {selectedScale && SCALE_NAMES[selectedScale]} - Shape{" "}
                  {shapeIndex + 1}
                </p>

                <div className="w-full">
                  <Fretboard markers={markers} />
                </div>

                <div className="flex gap-2">
                  {Array.from({ length: TOTAL_SHAPES }, (_, i) => (
                    <Button
                      key={i}
                      variant={shapeIndex === i ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setShapeIndex(i)
                      }}
                    >
                      Shape {i + 1}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                Select a scale and key above to preview the fretboard
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
