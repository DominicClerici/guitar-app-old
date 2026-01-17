"use client"

import { Fretboard, type Marker, type MarkerType } from "@/components/fretboard/fretboard"
import ScaleTrainerControls from "@/components/scale-trainer/scale-trainer-controls"
import SessionReview, { formatTime } from "@/components/scale-trainer/session-review"
import AnimatedUnmount from "@/components/ui/animated-unmount"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { type PitchData, useNoteDetection } from "@/hooks/useNoteDetection"
import { NOTE_NAMES, type NoteName } from "@/lib/audio/utils"
import { type ScaleType } from "@/lib/constants"
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
import { X } from "lucide-react"
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
  isActive: boolean,
): Marker[] {
  return notes.map((note) => {
    const key = createNoteKey(note.stringIndex, note.fretIndex)
    const isPlayed = playedNotes.has(key)
    const isRoot = note.degree === 1

    let type: MarkerType
    if (isPlayed || !isActive) {
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
      degree: note.degree,
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

export type DerivedSessionStats = {
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

export type SessionState = "idle" | "countdown" | "active" | "finished"
export type PracticeMode = "timed" | "unlimited"

export default function ScaleTrainerPage() {
  const [selectedScale, setSelectedScale] = useState<ScaleType | null>("major")
  const [selectedKey, setSelectedKey] = useState<NoteName | null>("C")
  const [showNotes, setShowNotes] = useState(true)
  const [showDegree, setShowDegree] = useState(false)

  const [sessionState, setSessionState] = useState<SessionState>("idle")
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("timed")
  const [countdown, setCountdown] = useState(COUNTDOWN_START)
  const [timerMs, setTimerMs] = useState(DEFAULT_DURATION_MS)
  const [shapeIndex, setShapeIndex] = useState<number | null>(0)
  const [playedNotes, setPlayedNotes] = useState<Set<string>>(new Set())
  const [sessionStats, setSessionStats] = useState<DerivedSessionStats | null>(null)

  const sessionRef = useRef<ScalePracticeSession | null>(null)
  const shapeStartTimeRef = useRef<number>(0)
  const isTransitioningRef = useRef(false)
  const shapeNotesRef = useRef<ScaleNote[]>([])
  const playedNotesRef = useRef<Set<string>>(new Set())
  const sessionStateRef = useRef<SessionState>("idle")

  const handlePitchDetected = useCallback((data: PitchData) => {
    if (sessionStateRef.current !== "active" || data.pitch <= 0 || isTransitioningRef.current) return

    for (const note of shapeNotesRef.current) {
      const noteKey = createNoteKey(note.stringIndex, note.fretIndex)
      if (playedNotesRef.current.has(noteKey)) continue

      if (isFrequencyMatch(data.pitch, note.targetFrequency)) {
        setPlayedNotes((prev) => {
          const next = new Set(prev).add(noteKey)
          playedNotesRef.current = next
          return next
        })
        break
      }
    }
  }, [])

  const {
    status: micStatus,
    startListening,
    stopListening,
  } = useNoteDetection({
    minClarity: 0.9,
    bufferSize: 2048,
    onPitchDetected: handlePitchDetected,
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

  const shapeNotes = useMemo(
    () => (shapeIndex === null ? fullScale : getShapeNotes(shapeIndex, fullScale)),
    [shapeIndex, fullScale],
  )

  const markers = useMemo(
    () => scaleNotesToMarkers(shapeNotes, playedNotes, showNotes, sessionState === "active"),
    [shapeNotes, playedNotes, showNotes, sessionState],
  )

  const selectRandomShape = useCallback(
    (isFirst = false) => {
      let newIndex = Math.floor(Math.random() * TOTAL_SHAPES)
      if (!isFirst && shapeIndex !== null) {
        while (newIndex === shapeIndex) {
          newIndex = Math.floor(Math.random() * TOTAL_SHAPES)
        }
      }
      setShapeIndex(newIndex)
      setPlayedNotes(new Set())
      isTransitioningRef.current = false
      shapeStartTimeRef.current = Date.now()
    },
    [shapeIndex],
  )

  const finalizeCurrentShape = useCallback(() => {
    if (!sessionRef.current || !selectedScale || !selectedKey || shapeIndex === null) return
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

  const startSession = useCallback(
    async (mode: PracticeMode) => {
      if (!selectedScale || !selectedKey) return

      await startListening()
      setCountdown(COUNTDOWN_START)
      setTimerMs(mode === "timed" ? DEFAULT_DURATION_MS : 0)
      setPracticeMode(mode)
      setSessionStats(null)
      setSessionState("countdown")
    },
    [selectedScale, selectedKey, startListening, selectRandomShape],
  )

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
      selectRandomShape(true)
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
  }, [sessionState, countdown, showNotes, selectedScale, selectRandomShape])

  useEffect(() => {
    if (sessionState !== "active") return
    if (practiceMode === "timed" && timerMs <= 0) {
      finalizeSession()
      return
    }
    const timer = setTimeout(
      () => setTimerMs((t) => (practiceMode === "timed" ? t - 1000 : t + 1000)),
      1000,
    )
    return () => clearTimeout(timer)
  }, [sessionState, timerMs, practiceMode, finalizeSession])

  useEffect(() => {
    shapeNotesRef.current = shapeNotes
  }, [shapeNotes])

  useEffect(() => {
    sessionStateRef.current = sessionState
  }, [sessionState])

  useEffect(() => {
    if (sessionState !== "active") return
    if (playedNotes.size === 0 || playedNotes.size < shapeNotes.length) return

    isTransitioningRef.current = true
    finalizeCurrentShape()
    const timeout = setTimeout(() => selectRandomShape(), SHAPE_COMPLETION_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [sessionState, playedNotes.size, shapeNotes.length, finalizeCurrentShape, selectRandomShape])

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <div className="mx-auto mt-12 w-full max-w-7xl">
        <AnimatedUnmount
          animClassIn="animation-fade-in"
          animClassOut="animation-fade-out"
          display={sessionState === "idle"}
        >
          <ScaleTrainerControls
            selectedScale={selectedScale}
            setSelectedScale={setSelectedScale}
            selectedKey={selectedKey}
            setSelectedKey={setSelectedKey}
            showNotes={showNotes}
            setShowNotes={setShowNotes}
            showDegree={showDegree}
            setShowDegree={setShowDegree}
            isListening={isListening}
            stopListening={stopListening}
            startListening={startListening}
            startSession={startSession}
          />
        </AnimatedUnmount>
        <AnimatedUnmount
          animClassIn="animation-fade-in"
          animClassOut="animation-fade-out"
          display={sessionState === "active"}
          className="flex flex-col items-center gap-2"
        >
          <div className="text-foreground text-4xl font-semibold tabular-nums">
            {formatTime(timerMs)}
          </div>
          <div className="text-muted-foreground text-sm">
            Shape {(shapeIndex ?? 0) + 1} of {TOTAL_SHAPES} • {playedNotes.size} /{" "}
            {shapeNotes.length} notes
          </div>
          <div className="flex gap-2">
            {practiceMode === "unlimited" && (
              <Button size="sm" onClick={finalizeSession}>
                End Session
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={cancelSession}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </AnimatedUnmount>
      </div>
      <Separator className="my-12" />
      <AnimatedUnmount
        animClassIn="animation-fade-in"
        animClassOut="animation-fade-out"
        display={sessionState === "countdown"}
        className="pointer-events-none absolute inset-0"
      >
        <div className="bg-background flex h-full w-full flex-col items-center justify-center">
          <span className="text-foreground text-9xl font-bold">{countdown}</span>
          <p className="text-muted-foreground mt-4 text-lg">Get ready...</p>
        </div>
      </AnimatedUnmount>

      <div className="flex flex-col items-center gap-4">
        <Fretboard className="mx-auto w-full max-w-7xl" markers={markers} showDegree={showDegree} />
        {sessionState === "idle" && !!selectedScale && !!selectedKey && (
          <div className="flex items-center gap-4">
            <Button
              variant={shapeIndex === null ? "default" : "outline"}
              size="sm"
              onClick={() => setShapeIndex(null)}
            >
              All Shapes
            </Button>
            {Array.from({ length: TOTAL_SHAPES }, (_, i) => (
              <Button
                key={i}
                variant={shapeIndex === i ? "default" : "outline"}
                size="sm"
                onClick={() => setShapeIndex(i)}
              >
                Shape {i + 1}
              </Button>
            ))}
          </div>
        )}
      </div>

      <AnimatedUnmount
        animClassIn="animation-fade-in"
        animClassOut="animation-fade-out"
        display={sessionState === "finished"}
        className="bg-card border-border max-w-md rounded-lg border p-6"
      >
        <SessionReview
          sessionStats={sessionStats}
          setSessionState={setSessionState}
          setPlayedNotes={setPlayedNotes}
          startSession={startSession}
          practiceMode={practiceMode}
        />
      </AnimatedUnmount>
    </div>
  )
}
