"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import SessionHeader, { type SessionConfig } from "@/components/practice/session-header"
import { Button } from "@/components/ui/button"
import { useNoteDetection } from "@/hooks/useNoteDetection"
import { freqToMidi, NOTE_NAMES, STRING_OPEN_MIDI } from "@/lib/audio/utils"
import {
  CAGED_SHAPE_NAMES,
  getCAGEDShapeNotes,
  getMajorScale,
  getNoteName,
  type ScaleNote,
} from "@/lib/scales/major-scale"
import { cn } from "@/lib/utils"
import { CheckIcon, MusicIcon, Pause, Play, Square } from "lucide-react"
import SlidingToggle from "../ui/sliding-toggle"
import { ScaleCurrentPositionInfo, ScaleTimerInfo } from "./scales-control-bar"

type PracticeState = "idle" | "countdown" | "practicing" | "paused" | "between-shapes" | "complete"

function getKeyIndex(key: string): number {
  if (key === "random") {
    return Math.floor(Math.random() * 12)
  }
  const index = NOTE_NAMES.indexOf(key)
  return index >= 0 ? index : 0
}

export function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function ScalesPracticeClient() {
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null)
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(0)
  const [activeShapes, setActiveShapes] = useState<number[]>([1, 2, 3, 4, 5])

  const [practiceState, setPracticeState] = useState<PracticeState>("idle")
  const [countdownValue, setCountdownValue] = useState(5)
  const [currentShapeIndex, setCurrentShapeIndex] = useState(0)
  const [playedNoteKeys, setPlayedNoteKeys] = useState<Set<string>>(new Set())
  const [completedShapesCount, setCompletedShapesCount] = useState(0)
  const [completedShapeName, setCompletedShapeName] = useState<string | null>(null)

  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [initialDurationSeconds, setInitialDurationSeconds] = useState(0)

  const [showDegree, setShowDegree] = useState(false)
  const practiceStateRef = useRef(practiceState)
  const currentShapeNotesRef = useRef<ScaleNote[]>([])
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem("practiceConfig")
    if (stored) {
      const config = JSON.parse(stored) as SessionConfig
      setSessionConfig(config)
      setSelectedKeyIndex(getKeyIndex(config.key))
      setActiveShapes(config.shapes)
      if (config.sessionType === "timed" && config.duration) {
        const totalSecs = config.duration.minutes * 60 + config.duration.seconds
        setRemainingSeconds(totalSecs)
        setInitialDurationSeconds(totalSecs)
      }
    }
  }, [])

  useEffect(() => {
    practiceStateRef.current = practiceState
  }, [practiceState])

  const fullScale = getMajorScale(selectedKeyIndex)
  const cagedShapeNames = activeShapes.map((i) => CAGED_SHAPE_NAMES[i - 1])
  const currentShapeName = cagedShapeNames[currentShapeIndex] || CAGED_SHAPE_NAMES[0]
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

  const clearTimerInterval = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }, [])

  const allNotesPlayed =
    currentShapeNotes.length > 0 &&
    currentShapeNotes.every((note) =>
      playedNoteKeys.has(getNoteKey(note.stringIndex, note.fretIndex)),
    )

  useEffect(() => {
    if (practiceState !== "practicing" || !allNotesPlayed) return

    setPracticeState("between-shapes")
    setCompletedShapeName(currentShapeName)
    setCompletedShapesCount((prev) => prev + 1)

    transitionTimerRef.current = setTimeout(() => {
      const nextIndex = currentShapeIndex + 1
      const isShapesMode = sessionConfig?.sessionType === "shapes"
      const targetShapes = sessionConfig?.targetShapes || cagedShapeNames.length

      if (isShapesMode && completedShapesCount + 1 >= targetShapes) {
        setPracticeState("complete")
        stopListening()
        clearTimerInterval()
      } else if (nextIndex >= cagedShapeNames.length) {
        setCurrentShapeIndex(0)
        setPlayedNoteKeys(new Set())
        setPracticeState("practicing")
      } else {
        setCurrentShapeIndex(nextIndex)
        setPlayedNoteKeys(new Set())
        setPracticeState("practicing")
      }
    }, 1500)
  }, [
    practiceState,
    allNotesPlayed,
    currentShapeIndex,
    cagedShapeNames.length,
    stopListening,
    sessionConfig,
    completedShapesCount,
    clearTimerInterval,
  ])

  useEffect(() => {
    if (practiceState === "practicing") {
      timerIntervalRef.current = setInterval(() => {
        if (sessionConfig?.sessionType === "infinite") {
          setElapsedSeconds((prev) => prev + 1)
        } else if (sessionConfig?.sessionType === "timed") {
          setRemainingSeconds((prev) => {
            if (prev <= 1) {
              setPracticeState("complete")
              stopListening()
              clearTimerInterval()
              return 0
            }
            return prev - 1
          })
        }
      }, 1000)
    } else if (practiceState === "paused") {
      clearTimerInterval()
    }

    return clearTimerInterval
  }, [practiceState, sessionConfig?.sessionType, stopListening, clearTimerInterval])

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
      clearTimerInterval()
    }
  }, [clearTimerInterval])

  const startPractice = async () => {
    setPracticeState("countdown")
    setCountdownValue(5)
    setCurrentShapeIndex(0)
    setPlayedNoteKeys(new Set())
    setCompletedShapesCount(0)
    setElapsedSeconds(0)
    if (sessionConfig?.sessionType === "timed" && sessionConfig.duration) {
      const totalSecs = sessionConfig.duration.minutes * 60 + sessionConfig.duration.seconds
      setRemainingSeconds(totalSecs)
    }

    await startListening()

    let count = 5
    countdownIntervalRef.current = setInterval(() => {
      count--
      if (count === 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
        }
        setPracticeState("practicing")
      } else {
        setCountdownValue(count)
      }
    }, 1000)
  }

  const cancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }
    setPracticeState("idle")
    setCountdownValue(0)
  }

  const pausePractice = () => {
    setPracticeState("paused")
  }

  const resumePractice = () => {
    setPracticeState("practicing")
  }

  const endPractice = () => {
    setPracticeState("complete")
    stopListening()
    clearTimerInterval()
  }

  const resetToIdle = () => {
    setPracticeState("idle")
    stopListening()
    clearTimerInterval()
    setPlayedNoteKeys(new Set())
    setCompletedShapesCount(0)
    setElapsedSeconds(0)
    if (sessionConfig?.sessionType === "timed" && sessionConfig.duration) {
      const totalSecs = sessionConfig.duration.minutes * 60 + sessionConfig.duration.seconds
      setRemainingSeconds(totalSecs)
    }
  }

  const isInSession = practiceState !== "idle" && practiceState !== "complete"

  const displayNotes = isInSession ? currentShapeNotes : fullScale

  const markers: Marker[] = displayNotes.map((note) => {
    const noteKey = getNoteKey(note.stringIndex, note.fretIndex)
    const isPlayed = playedNoteKeys.has(noteKey)

    let type: Marker["type"]
    if (isInSession && isPlayed) {
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

  if (!sessionConfig) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-muted-foreground">Loading session...</div>
      </div>
    )
  }

  const targetShapes = sessionConfig.targetShapes || 10

  return (
    <div className="flex flex-col gap-6">
      <SessionHeader config={sessionConfig} hideShapes={isInSession} />

      {/* Countdown State */}
      {practiceState === "countdown" && (
        <div
          onClick={cancelCountdown}
          className="bg-background/60 absolute inset-0 z-50 flex flex-col items-center justify-center gap-4"
        >
          {/* Animated rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="border-primary/20 absolute size-32 animate-ping rounded-full border-2"
              style={{ animationDuration: "1s" }}
            />
            <div
              className="border-primary/10 absolute size-48 animate-ping rounded-full border"
              style={{ animationDuration: "1s", animationDelay: "0.2s" }}
            />
          </div>

          <span className="text-muted-foreground relative z-10 text-sm font-semibold tracking-[0.3em] uppercase">
            Get Ready
          </span>

          <div className="relative z-10 flex size-32 items-center justify-center">
            <div className="from-primary/20 to-primary/5 absolute inset-0 rounded-full bg-gradient-to-br" />
            <span
              key={countdownValue}
              className="font-display animate-scale-in text-7xl font-bold tabular-nums"
            >
              {countdownValue}
            </span>
          </div>

          <p className="text-muted-foreground relative z-10 text-sm">
            Position your hands on the fretboard
          </p>
        </div>
      )}

      {practiceState !== "complete" && (
        <div className="relative z-10 mb-12">
          <div className="bg-card relative z-10 h-24 rounded-2xl border">
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-[0.03]">
              <svg className="h-full w-full" preserveAspectRatio="none">
                <defs>
                  <pattern id="practice-dots" patternUnits="userSpaceOnUse" width="20" height="20">
                    <circle cx="2" cy="2" r="1" fill="currentColor" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#practice-dots)" />
              </svg>
            </div>

            {(practiceState === "practicing" ||
              practiceState === "paused" ||
              practiceState === "idle" ||
              practiceState === "countdown" ||
              practiceState === "between-shapes") && (
              <div className="relative z-10 grid h-full grid-cols-3 items-center gap-4 p-5">
                {/* Left section - Current shape and progress */}
                <ScaleCurrentPositionInfo
                  shapeName={
                    practiceState === "countdown" || practiceState === "idle"
                      ? "--"
                      : currentShapeName
                  }
                  notesPlayed={
                    practiceState === "countdown" || practiceState === "idle"
                      ? "--"
                      : playedNoteKeys.size
                  }
                  totalNotes={
                    practiceState === "countdown" || practiceState === "idle"
                      ? "--"
                      : currentShapeNotes.length
                  }
                  className="justify-self-start"
                />

                {/* Center section - Timer/Counter based on mode */}
                <ScaleTimerInfo
                  timer={sessionConfig?.sessionType === "timed" ? remainingSeconds : elapsedSeconds}
                  sessionType={sessionConfig?.sessionType || "infinite"}
                  initialDurationSeconds={
                    sessionConfig?.sessionType === "timed" ? initialDurationSeconds : 0
                  }
                  practiceState={practiceState}
                  completedShapesCount={
                    sessionConfig?.sessionType === "shapes" ? completedShapesCount : 0
                  }
                  targetShapes={sessionConfig?.sessionType === "shapes" ? targetShapes : 0}
                  className="justify-self-center"
                />

                {/* Right section - Controls */}
                {(practiceState === "practicing" || practiceState === "paused") && (
                  <div className="flex items-center gap-2 justify-self-end">
                    {practiceState === "practicing" ? (
                      <Button variant="outline" size="lg" onClick={pausePractice}>
                        <Pause />
                        Pause
                      </Button>
                    ) : (
                      <Button variant="default" size="lg" onClick={resumePractice}>
                        <Play className="fill-current" />
                        Resume
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={endPractice}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Square />
                      End
                    </Button>
                  </div>
                )}
                {practiceState === "idle" && (
                  <Button size="lg" onClick={startPractice} className="justify-self-end">
                    <Play className="fill-current" />
                    Begin Session
                  </Button>
                )}
              </div>
            )}
          </div>
          {/* Overlay status messages */}
          <div
            className={`bg-accent left absolute bottom-0 w-full rounded-b-2xl border px-5 pt-8 pb-3 text-center transition-all duration-300 ${practiceState === "paused" ? "translate-y-12 opacity-100" : "translate-y-0 opacity-0"}`}
          >
            <span className="text-muted-foreground text-sm font-medium">
              Session paused — Press resume to continue
            </span>
          </div>
          <div
            className={`bg-accent left absolute bottom-0 w-full rounded-b-2xl border px-5 pt-8 pb-3 text-center transition-all duration-300 ${practiceState === "between-shapes" ? "translate-y-14 opacity-100" : "translate-y-0 opacity-0"}`}
          >
            {/* Between Shapes State */}

            <div className="flex items-center justify-center gap-2">
              <div className="from-primary/20 to-primary/5 flex size-8 items-center justify-center rounded-full bg-gradient-to-br">
                <CheckIcon className="text-primary size-5" />
              </div>

              <h3 className="text-xl font-medium">
                <span className="text-primary">{completedShapeName}</span> Complete!
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* Complete State */}
      {practiceState === "complete" && (
        <div className="flex flex-col items-center gap-8 py-14">
          {/* Success icon */}
          <div className="relative">
            <div className="bg-primary/20 absolute inset-0 animate-ping rounded-full" />
            <div className="from-primary to-primary/80 relative flex size-20 items-center justify-center rounded-full bg-gradient-to-br">
              <svg className="text-primary-foreground size-10" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <div className="space-y-2 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight">Session Complete!</h2>
            <p className="text-muted-foreground text-lg">Great work on your practice session.</p>
          </div>

          {/* Session stats */}
          <div className="bg-card/50 flex items-center gap-6 rounded-2xl border px-8 py-5">
            {sessionConfig.sessionType === "infinite" && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Time
                </span>
                <span className="font-display text-2xl font-bold">
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
            )}
            {sessionConfig.sessionType === "timed" && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  Duration
                </span>
                <span className="font-display text-2xl font-bold">
                  {formatTime(initialDurationSeconds - remainingSeconds)}
                </span>
              </div>
            )}
            <div className="bg-border h-10 w-px" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Shapes
              </span>
              <span className="font-display text-2xl font-bold">{completedShapesCount}</span>
            </div>
          </div>

          <Button
            onClick={resetToIdle}
            size="lg"
            className="h-14 rounded-2xl px-10 text-lg font-semibold"
          >
            Done
          </Button>
        </div>
      )}

      {/* Fretboard */}
      {practiceState !== "complete" && (
        <div
          className={cn(
            "transition-opacity duration-300",
            (practiceState === "paused" || practiceState === "countdown") && "opacity-50",
          )}
        >
          <Fretboard
            markers={practiceState === "countdown" ? [] : markers}
            showDegree={showDegree}
            className="w-full"
          />
        </div>
      )}
      {practiceState === "idle" && (
        <div className="flex flex-col items-center justify-center gap-4">
          {/* Add controls here */}
          <SlidingToggle
            options={[
              {
                label: "Interval",
                value: "interval",
                icon: <span className="font-mono text-lg font-medium">1</span>,
              },
              { label: "Note", value: "note", icon: <MusicIcon /> },
            ]}
            value={showDegree ? "interval" : "note"}
            onChange={(value) => setShowDegree(value === "interval")}
          />
        </div>
      )}
    </div>
  )
}
