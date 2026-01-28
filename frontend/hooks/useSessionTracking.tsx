"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

export interface SpeedWindow {
  notes: number
  shapes: number[]
}

export interface ShapeCompletionTime {
  shapeIndex: number
  shapeName: string
  durationMs: number
}

export interface SessionTrackingData {
  speedWindows: SpeedWindow[]
  shapeCompletionTimes: ShapeCompletionTime[]
  totalNotesPlayed: number
  totalShapesCompleted: number
  elapsedMs: number
}

interface SessionTrackingContextType {
  speedWindows: SpeedWindow[]
  shapeCompletionTimes: ShapeCompletionTime[]
  totalNotesPlayed: number
  totalShapesCompleted: number
  elapsedMs: number
  isTracking: boolean
  isPaused: boolean
  recordNotePlayed: () => void
  startShapeTimer: (shapeIndex: number, shapeName: string) => void
  completeShape: () => void
  resetTracking: () => void
  getSessionData: () => SessionTrackingData
  startSession: () => void
  pauseSession: () => void
  resumeSession: () => void
  stopSession: () => void
}

const SessionTrackingContext = createContext<SessionTrackingContextType | null>(null)

const WINDOW_INTERVAL_MS = 5000

export function SessionTrackingProvider({ children }: { children: React.ReactNode }) {
  const [speedWindows, setSpeedWindows] = useState<SpeedWindow[]>([])
  const [shapeCompletionTimes, setShapeCompletionTimes] = useState<ShapeCompletionTime[]>([])
  const [totalNotesPlayed, setTotalNotesPlayed] = useState(0)
  const [totalShapesCompleted, setTotalShapesCompleted] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isTracking, setIsTracking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  const notesInCurrentWindowRef = useRef(0)
  const shapesInCurrentWindowRef = useRef<number[]>([])
  const windowIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentShapeStartTimeRef = useRef<number | null>(null)
  const currentShapeInfoRef = useRef<{ shapeIndex: number; shapeName: string } | null>(null)
  const pausedTimeRef = useRef<number | null>(null)
  const pausedShapeElapsedRef = useRef<number>(0)

  const clearIntervals = useCallback(() => {
    if (windowIntervalRef.current) {
      clearInterval(windowIntervalRef.current)
      windowIntervalRef.current = null
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current)
      elapsedIntervalRef.current = null
    }
  }, [])

  const snapshotWindow = useCallback(() => {
    const windowData: SpeedWindow = {
      notes: notesInCurrentWindowRef.current,
      shapes: [...shapesInCurrentWindowRef.current],
    }
    setSpeedWindows((prev) => [...prev, windowData])
    notesInCurrentWindowRef.current = 0
    shapesInCurrentWindowRef.current = []
  }, [])

  const startIntervals = useCallback(() => {
    clearIntervals()

    elapsedIntervalRef.current = setInterval(() => {
      setElapsedMs((prev) => prev + 100)
    }, 100)

    windowIntervalRef.current = setInterval(() => {
      snapshotWindow()
    }, WINDOW_INTERVAL_MS)
  }, [clearIntervals, snapshotWindow])

  const startSession = useCallback(() => {
    setIsTracking(true)
    setIsPaused(false)
    startIntervals()
  }, [startIntervals])

  const pauseSession = useCallback(() => {
    if (!isTracking || isPaused) return

    setIsPaused(true)
    clearIntervals()

    if (currentShapeStartTimeRef.current !== null) {
      pausedShapeElapsedRef.current = Date.now() - currentShapeStartTimeRef.current
    }
    pausedTimeRef.current = Date.now()
  }, [isTracking, isPaused, clearIntervals])

  const resumeSession = useCallback(() => {
    if (!isTracking || !isPaused) return

    setIsPaused(false)

    if (currentShapeStartTimeRef.current !== null) {
      currentShapeStartTimeRef.current = Date.now() - pausedShapeElapsedRef.current
    }
    pausedTimeRef.current = null

    startIntervals()
  }, [isTracking, isPaused, startIntervals])

  const stopSession = useCallback(() => {
    if (notesInCurrentWindowRef.current > 0 || shapesInCurrentWindowRef.current.length > 0) {
      snapshotWindow()
    }

    setIsTracking(false)
    setIsPaused(false)
    clearIntervals()
  }, [clearIntervals, snapshotWindow])

  const recordNotePlayed = useCallback(() => {
    if (!isTracking || isPaused) return

    notesInCurrentWindowRef.current += 1
    setTotalNotesPlayed((prev) => prev + 1)
  }, [isTracking, isPaused])

  const startShapeTimer = useCallback(
    (shapeIndex: number, shapeName: string) => {
      if (!isTracking || isPaused) return

      currentShapeStartTimeRef.current = Date.now()
      currentShapeInfoRef.current = { shapeIndex, shapeName }
      pausedShapeElapsedRef.current = 0

      if (!shapesInCurrentWindowRef.current.includes(shapeIndex)) {
        shapesInCurrentWindowRef.current.push(shapeIndex)
      }
    },
    [isTracking, isPaused],
  )

  const completeShape = useCallback(() => {
    if (!isTracking || currentShapeStartTimeRef.current === null || !currentShapeInfoRef.current)
      return

    const durationMs = Date.now() - currentShapeStartTimeRef.current

    const completionTime: ShapeCompletionTime = {
      shapeIndex: currentShapeInfoRef.current.shapeIndex,
      shapeName: currentShapeInfoRef.current.shapeName,
      durationMs,
    }

    setShapeCompletionTimes((prev) => [...prev, completionTime])
    setTotalShapesCompleted((prev) => prev + 1)

    currentShapeStartTimeRef.current = null
    currentShapeInfoRef.current = null
    pausedShapeElapsedRef.current = 0
  }, [isTracking])

  const resetTracking = useCallback(() => {
    clearIntervals()
    setSpeedWindows([])
    setShapeCompletionTimes([])
    setTotalNotesPlayed(0)
    setTotalShapesCompleted(0)
    setElapsedMs(0)
    setIsTracking(false)
    setIsPaused(false)

    notesInCurrentWindowRef.current = 0
    shapesInCurrentWindowRef.current = []
    currentShapeStartTimeRef.current = null
    currentShapeInfoRef.current = null
    pausedTimeRef.current = null
    pausedShapeElapsedRef.current = 0
  }, [clearIntervals])

  const getSessionData = useCallback((): SessionTrackingData => {
    return {
      speedWindows,
      shapeCompletionTimes,
      totalNotesPlayed,
      totalShapesCompleted,
      elapsedMs,
    }
  }, [speedWindows, shapeCompletionTimes, totalNotesPlayed, totalShapesCompleted, elapsedMs])

  useEffect(() => {
    return () => {
      clearIntervals()
    }
  }, [clearIntervals])

  return (
    <SessionTrackingContext.Provider
      value={{
        speedWindows,
        shapeCompletionTimes,
        totalNotesPlayed,
        totalShapesCompleted,
        elapsedMs,
        isTracking,
        isPaused,
        recordNotePlayed,
        startShapeTimer,
        completeShape,
        resetTracking,
        getSessionData,
        startSession,
        pauseSession,
        resumeSession,
        stopSession,
      }}
    >
      {children}
    </SessionTrackingContext.Provider>
  )
}

export function useSessionTracking() {
  const context = useContext(SessionTrackingContext)
  if (!context) {
    throw new Error("useSessionTracking must be used within a SessionTrackingProvider")
  }
  return context
}
