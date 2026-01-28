"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import SessionHeader, { type SessionConfig } from "@/components/practice/session-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { useNoteDetection } from "@/hooks/useNoteDetection"
import { useSessionTracking } from "@/hooks/useSessionTracking"
import { freqToMidi, NOTE_NAMES, STRING_OPEN_MIDI } from "@/lib/audio/utils"
import {
  ARPEGGIO_FORMULAS,
  CAGED_SHAPE_NAMES,
  type FretboardNote,
  generateFretboardNotes,
  getCAGEDShapeNotes,
  getNoteName,
  SCALE_FORMULAS,
} from "@/lib/theory"
import { trpc } from "@/lib/trpc/react"
import { cn } from "@/lib/utils"
import {
  Activity,
  CheckIcon,
  Clock,
  Flame,
  MusicIcon,
  Pause,
  Play,
  Square,
  TrendingUp,
  Zap,
} from "lucide-react"
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

// Chart configurations
const speedChartConfig = {
  notes: {
    label: "Notes",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

const shapeChartConfig = {
  time: {
    label: "Time (s)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

interface SessionReviewScreenProps {
  sessionConfig: SessionConfig
  elapsedSeconds: number
  initialDurationSeconds: number
  remainingSeconds: number
  completedShapesCount: number
  totalNotesPlayed: number
  speedWindows: { notes: number; shapes: number[] }[]
  shapeCompletionTimes: { shapeIndex: number; shapeName: string; durationMs: number }[]
  onDone: () => void
}

function SessionReviewScreen({
  sessionConfig,
  elapsedSeconds,
  initialDurationSeconds,
  remainingSeconds,
  completedShapesCount,
  totalNotesPlayed,
  speedWindows,
  shapeCompletionTimes,
  onDone,
}: SessionReviewScreenProps) {
  const sessionDuration =
    sessionConfig.sessionType === "timed"
      ? initialDurationSeconds - remainingSeconds
      : elapsedSeconds

  const speedWindowsData = speedWindows.map((window, index) => {
    const seconds = (index + 1) * 5
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return {
      interval: `${mins}:${secs.toString().padStart(2, "0")}`,
      notes: window.notes,
    }
  })

  const shapeCompletionData = shapeCompletionTimes.map((item) => ({
    shape: item.shapeName,
    time: Math.round(item.durationMs / 100) / 10,
  }))

  const avgNotesPerWindow =
    speedWindowsData.length > 0
      ? speedWindowsData.reduce((sum, w) => sum + w.notes, 0) / speedWindowsData.length
      : 0
  const peakNotesWindow =
    speedWindowsData.length > 0 ? Math.max(...speedWindowsData.map((w) => w.notes)) : 0
  const avgSecondsPerShape =
    shapeCompletionData.length > 0
      ? shapeCompletionData.reduce((sum, s) => sum + s.time, 0) / shapeCompletionData.length
      : 0

  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Header with success icon */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="bg-primary/20 absolute inset-0 animate-ping rounded-full opacity-75" />
          <div className="from-primary to-primary/80 relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br shadow-lg">
            <CheckIcon className="text-primary-foreground size-8" strokeWidth={3} />
          </div>
        </div>
        <div className="space-y-1 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight">Session Complete</h2>
          <p className="text-muted-foreground">Here's how you performed</p>
        </div>
      </div>

      {/* Primary Stats Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Duration */}
        <Card className="bg-card/50 flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
              <Clock className="text-primary size-4" />
            </div>
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Duration
            </span>
          </div>
          <span className="font-display text-2xl font-bold tabular-nums">
            {formatTime(sessionDuration)}
          </span>
        </Card>

        {/* Shapes Completed */}
        <Card className="bg-card/50 flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <div className="bg-chart-2/10 flex size-8 items-center justify-center rounded-lg">
              <Activity className="text-chart-2 size-4" />
            </div>
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Shapes
            </span>
          </div>
          <span className="font-display text-2xl font-bold tabular-nums">
            {completedShapesCount}
          </span>
        </Card>

        {/* Avg Notes per 5s */}
        <Card className="bg-card/50 flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <div className="bg-chart-3/10 flex size-8 items-center justify-center rounded-lg">
              <TrendingUp className="text-chart-3 size-4" />
            </div>
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Avg Notes/5s
            </span>
          </div>
          <span className="font-display text-2xl font-bold tabular-nums">
            {avgNotesPerWindow.toFixed(1)}
          </span>
        </Card>

        {/* Peak Performance */}
        <Card className="bg-card/50 flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <div className="bg-chart-4/10 flex size-8 items-center justify-center rounded-lg">
              <Zap className="text-chart-4 size-4" />
            </div>
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Peak Notes/5s
            </span>
          </div>
          <span className="font-display text-2xl font-bold tabular-nums">{peakNotesWindow}</span>
        </Card>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {/* Total Notes */}
        <Card className="bg-card/50 flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <div className="bg-chart-5/10 flex size-8 items-center justify-center rounded-lg">
              <MusicIcon className="text-chart-5 size-4" />
            </div>
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Total Notes
            </span>
          </div>
          <span className="font-display text-2xl font-bold tabular-nums">{totalNotesPlayed}</span>
        </Card>

        {/* Avg Time per Shape */}
        <Card className="bg-card/50 flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <div className="bg-chart-1/10 flex size-8 items-center justify-center rounded-lg">
              <Flame className="text-chart-1 size-4" />
            </div>
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Avg Sec/Shape
            </span>
          </div>
          <span className="font-display text-2xl font-bold tabular-nums">
            {avgSecondsPerShape.toFixed(1)}s
          </span>
        </Card>

        {/* Notes per Minute */}
        <Card className="bg-card/50 col-span-2 flex flex-col gap-2 p-4 md:col-span-1">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
              <Activity className="text-primary size-4" />
            </div>
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Notes/Min
            </span>
          </div>
          <span className="font-display text-2xl font-bold tabular-nums">
            {sessionDuration > 0 ? Math.round((totalNotesPlayed / sessionDuration) * 60) : 0}
          </span>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Speed Over Time Chart */}
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Speed Over Time</h3>
              <p className="text-muted-foreground text-sm">Notes played per 5-second interval</p>
            </div>
            <div className="bg-chart-1/10 flex size-10 items-center justify-center rounded-xl">
              <TrendingUp className="text-chart-1 size-5" />
            </div>
          </div>
          <ChartContainer config={speedChartConfig} className="h-[200px] w-full">
            <AreaChart data={speedWindowsData} margin={{ left: 0, right: 0, top: 10 }}>
              <defs>
                <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
              <XAxis
                dataKey="interval"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
                className="text-muted-foreground"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
                className="text-muted-foreground"
                width={30}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="notes"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#speedGradient)"
              />
            </AreaChart>
          </ChartContainer>
        </Card>

        {/* Shape Completion Times Chart */}
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Shape Completion Times</h3>
              <p className="text-muted-foreground text-sm">Seconds to complete each CAGED shape</p>
            </div>
            <div className="bg-chart-2/10 flex size-10 items-center justify-center rounded-xl">
              <Activity className="text-chart-2 size-5" />
            </div>
          </div>
          <ChartContainer config={shapeChartConfig} className="h-[200px] w-full">
            <BarChart data={shapeCompletionData} margin={{ left: 0, right: 0, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
              <XAxis
                dataKey="shape"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
                className="text-muted-foreground"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
                className="text-muted-foreground"
                width={30}
                tickFormatter={(value) => `${value}s`}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value) => [`${value}s`, "Time"]}
              />
              <Bar dataKey="time" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>
      </div>

      {/* Done Button */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={onDone}
          size="lg"
          className="h-14 rounded-2xl px-12 text-lg font-semibold shadow-lg transition-all hover:scale-105"
        >
          Done
        </Button>
      </div>
    </div>
  )
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
  const [previewShape, setPreviewShape] = useState<string>("full")
  const practiceStateRef = useRef(practiceState)
  const currentShapeNotesRef = useRef<FretboardNote[]>([])
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const totalNotesPlayedRef = useRef(0)
  const sessionSavedRef = useRef(false)

  const saveSession = trpc.sessions.saveNewSession.useMutation()

  const {
    speedWindows,
    shapeCompletionTimes,
    totalNotesPlayed: trackingTotalNotes,
    recordNotePlayed,
    startShapeTimer,
    completeShape: completeShapeTracking,
    resetTracking,
    startSession: startTrackingSession,
    pauseSession: pauseTrackingSession,
    resumeSession: resumeTrackingSession,
    stopSession: stopTrackingSession,
  } = useSessionTracking()

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

  const formula =
    sessionConfig?.formulaType === "arpeggio"
      ? ARPEGGIO_FORMULAS[sessionConfig.formulaId]
      : SCALE_FORMULAS[sessionConfig?.formulaId ?? "major"]
  const fullScale = formula ? generateFretboardNotes(selectedKeyIndex, formula) : []
  const cagedShapeNames = activeShapes.map((i) => CAGED_SHAPE_NAMES[i - 1])
  const currentShapeName = cagedShapeNames[currentShapeIndex] || CAGED_SHAPE_NAMES[0]
  const currentShapeNotes = getCAGEDShapeNotes(
    currentShapeName,
    fullScale,
    selectedKeyIndex,
    undefined,
    formula,
  )

  useEffect(() => {
    currentShapeNotesRef.current = currentShapeNotes
  }, [currentShapeNotes])

  const getNoteKey = (stringIndex: number, fretIndex: number) => `${stringIndex}-${fretIndex}`

  const getMidiForPosition = (stringIndex: number, fretIndex: number) =>
    STRING_OPEN_MIDI[stringIndex] + fretIndex

  const handlePitchDetected = useCallback(
    ({ pitch }: { pitch: number; clarity: number }) => {
      if (practiceStateRef.current !== "practicing" || pitch <= 0) return

      const detectedMidi = Math.round(freqToMidi(pitch))

      const shapeNotes = currentShapeNotesRef.current
      const matchingNotes = shapeNotes.filter(
        (note) => getMidiForPosition(note.stringIndex, note.fretIndex) === detectedMidi,
      )

      if (matchingNotes.length > 0) {
        recordNotePlayed()
        setPlayedNoteKeys((prev) => {
          const next = new Set(prev)
          for (const note of matchingNotes) {
            next.add(getNoteKey(note.stringIndex, note.fretIndex))
          }
          return next
        })
      }
    },
    [recordNotePlayed],
  )

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

    completeShapeTracking()
    setPracticeState("between-shapes")
    setCompletedShapeName(currentShapeName)
    setCompletedShapesCount((prev) => prev + 1)
    totalNotesPlayedRef.current += playedNoteKeys.size

    transitionTimerRef.current = setTimeout(() => {
      const nextIndex = currentShapeIndex + 1
      const isShapesMode = sessionConfig?.sessionType === "shapes"
      const targetShapes = sessionConfig?.targetShapes || cagedShapeNames.length

      if (isShapesMode && completedShapesCount + 1 >= targetShapes) {
        setPracticeState("complete")
        stopListening()
        clearTimerInterval()
        stopTrackingSession()
      } else if (nextIndex >= cagedShapeNames.length) {
        setCurrentShapeIndex(0)
        setPlayedNoteKeys(new Set())
        setPracticeState("practicing")
        startShapeTimer(0, cagedShapeNames[0])
      } else {
        setCurrentShapeIndex(nextIndex)
        setPlayedNoteKeys(new Set())
        setPracticeState("practicing")
        startShapeTimer(nextIndex, cagedShapeNames[nextIndex])
      }
    }, 1500)
  }, [
    practiceState,
    allNotesPlayed,
    currentShapeIndex,
    cagedShapeNames,
    stopListening,
    sessionConfig,
    completedShapesCount,
    clearTimerInterval,
    completeShapeTracking,
    startShapeTimer,
    stopTrackingSession,
  ])

  useEffect(() => {
    if (practiceState === "practicing") {
      timerIntervalRef.current = setInterval(() => {
        if (sessionConfig?.sessionType === "infinite") {
          setElapsedSeconds((prev) => prev + 1)
        } else if (sessionConfig?.sessionType === "timed") {
          setRemainingSeconds((prev) => prev - 1)
        }
      }, 1000)
    } else if (practiceState === "paused") {
      clearTimerInterval()
    }

    return clearTimerInterval
  }, [practiceState, sessionConfig?.sessionType, clearTimerInterval])

  useEffect(() => {
    if (
      sessionConfig?.sessionType === "timed" &&
      practiceState === "practicing" &&
      remainingSeconds <= 0
    ) {
      setPracticeState("complete")
      stopListening()
      clearTimerInterval()
      stopTrackingSession()
    }
  }, [
    remainingSeconds,
    practiceState,
    sessionConfig?.sessionType,
    stopListening,
    clearTimerInterval,
    stopTrackingSession,
  ])

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

  useEffect(() => {
    if (practiceState !== "complete" || sessionSavedRef.current || !sessionConfig) return

    const duration =
      sessionConfig.sessionType === "timed"
        ? initialDurationSeconds - remainingSeconds
        : elapsedSeconds

    const shouldSave = duration >= 60 || completedShapesCount >= 5

    if (!shouldSave) return

    sessionSavedRef.current = true
    saveSession.mutate({
      duration,
      type: "scales",
      timingMode: sessionConfig.sessionType,
      keys: [NOTE_NAMES[selectedKeyIndex]],
      sessionData: {
        type: "scales",
        key: selectedKeyIndex,
        shapes: activeShapes,
        shapesCompleted: completedShapesCount,
        totalNotesPlayed: trackingTotalNotes,
        speedWindows,
        shapeCompletionTimes,
      },
    })
  }, [
    practiceState,
    sessionConfig,
    initialDurationSeconds,
    remainingSeconds,
    elapsedSeconds,
    completedShapesCount,
    selectedKeyIndex,
    activeShapes,
    saveSession,
    trackingTotalNotes,
    speedWindows,
    shapeCompletionTimes,
  ])

  const startPractice = async () => {
    setPracticeState("countdown")
    setCountdownValue(5)
    setCurrentShapeIndex(0)
    setPlayedNoteKeys(new Set())
    setCompletedShapesCount(0)
    setElapsedSeconds(0)
    totalNotesPlayedRef.current = 0
    sessionSavedRef.current = false
    resetTracking()
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
        startTrackingSession()
        startShapeTimer(0, cagedShapeNames[0])
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
    pauseTrackingSession()
  }

  const resumePractice = () => {
    setPracticeState("practicing")
    resumeTrackingSession()
  }

  const endPractice = () => {
    setPracticeState("complete")
    stopListening()
    clearTimerInterval()
    stopTrackingSession()
  }

  const resetToIdle = () => {
    setPracticeState("idle")
    stopListening()
    clearTimerInterval()
    setPlayedNoteKeys(new Set())
    setCompletedShapesCount(0)
    setElapsedSeconds(0)
    resetTracking()
    if (sessionConfig?.sessionType === "timed" && sessionConfig.duration) {
      const totalSecs = sessionConfig.duration.minutes * 60 + sessionConfig.duration.seconds
      setRemainingSeconds(totalSecs)
    }
  }

  const isInSession = practiceState !== "idle" && practiceState !== "complete"

  const previewNotes =
    previewShape === "full"
      ? fullScale
      : getCAGEDShapeNotes(
          previewShape as "C" | "A" | "G" | "E" | "D",
          fullScale,
          selectedKeyIndex,
          undefined,
          formula,
        )

  const displayNotes = isInSession ? currentShapeNotes : previewNotes

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

      {/* Complete State - Enhanced Review Screen */}
      {practiceState === "complete" && (
        <SessionReviewScreen
          sessionConfig={sessionConfig}
          elapsedSeconds={elapsedSeconds}
          initialDurationSeconds={initialDurationSeconds}
          remainingSeconds={remainingSeconds}
          completedShapesCount={completedShapesCount}
          totalNotesPlayed={trackingTotalNotes}
          speedWindows={speedWindows}
          shapeCompletionTimes={shapeCompletionTimes}
          onDone={resetToIdle}
        />
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
        <div className="flex flex-col items-center gap-2">
          <p className="text-muted-foreground text-xs">Preview</p>
          <div className="flex items-center justify-center gap-4">
            <SlidingToggle
              options={[
                { label: "Full", value: "full" },
                ...cagedShapeNames.map((shape) => ({ label: shape, value: shape })),
              ]}
              value={previewShape}
              onChange={setPreviewShape}
              className="h-12"
            />
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
              className="h-12"
            />
          </div>
        </div>
      )}
    </div>
  )
}
