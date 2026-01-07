import { Fretboard } from "@/components/fretboard/fretboard"
import { ScreenContainer } from "@/components/ScreenContainer"
import { buttonVariants } from "@/components/ui/button"
import { PitchAlgorithm, useFastPitchDetection } from "@/lib/audio/useFastPitchDetection"
import { NOTE_NAMES, NoteName } from "@/lib/audio/utils"
import { ScaleType } from "@/lib/constants"
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
  ScaleNote,
} from "@/lib/scales/major-scale"
import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import { useLocalSearchParams } from "expo-router"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react-native"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

function isFrequencyMatch(detected: number, target: number, tolerance: number = 0.02): boolean {
  if (detected <= 0) return false
  const lowerBound = target * (1 - tolerance)
  const upperBound = target * (1 + tolerance)
  return detected >= lowerBound && detected <= upperBound
}

export type ScalePracticeShape = {
  shapeIndex: number
  duration: number
  key: NoteName
  scale: ScaleType
  showNotes: boolean
  noteCount: number
  fretRange: [number, number]
}

export type ScalePracticeSession = {
  startTime: number
  endTime: number
  showNotes: boolean
  scale: ScaleType
  shapes: ScalePracticeShape[]
}

export type ScalePracticeParams = {
  scale: ScaleType
  key: NoteName
  showNotes: "true" | "false"
  duration: string // is a number in seconds, with minimum of 30 and maximum of 600 (10 minutes)
}

type Marker = {
  stringIndex: number
  fretIndex: number
  type: "root-disabled" | "root" | "note-disabled" | "note" | "root-hidden" | "note-hidden"
  label: string
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

    let type: Marker["type"]
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

function calculateViewFrets(shapeNotes: ScaleNote[]): [number, number] {
  if (shapeNotes.length === 0) return [0, 6]

  const frets = shapeNotes.map((n) => n.fretIndex)
  const minFret = Math.min(...frets)
  const maxFret = Math.max(...frets)
  const span = maxFret - minFret + 1

  const displayCount = span <= 4 ? 6 : 7

  const startFret = Math.max(0, minFret - 1)
  const endFret = startFret + displayCount - 1

  return [startFret, endFret]
}

const SHAPE_COMPLETION_DELAY_MS = 1000
const TOTAL_SHAPES = 5
const COUNTDOWN_START = 4

type SessionState = "countdown" | "active" | "finished"

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

export default function PracticePage() {
  const colors = useColors()
  const styles = createStyles(colors)
  const { scale, key, showNotes, duration = "60" } = useLocalSearchParams<ScalePracticeParams>()

  const durationMs = parseInt(duration, 10) * 1000

  const [sessionState, setSessionState] = useState<SessionState>("countdown")
  const [countdown, setCountdown] = useState(COUNTDOWN_START)
  const [remainingMs, setRemainingMs] = useState(durationMs)
  const [shapeIndex, setShapeIndex] = useState(0)
  const [viewFrets, setViewFrets] = useState<[number, number]>([0, 6])
  const [playedNotes, setPlayedNotes] = useState<Set<string>>(new Set())

  const sessionRef = useRef<ScalePracticeSession | null>(null)
  const shapeStartTimeRef = useRef<number>(0)
  const lastMatchRef = useRef<string | null>(null)
  const isTransitioningRef = useRef(false)

  const { pitch } = useFastPitchDetection({
    minVolume: -70.0,
    updateIntervalMs: 27.5, // 32.5 for 1536, 43 for 2048
    bufferSize: 1280, // if too low, try 1536, then 2048
    algorithm: PitchAlgorithm.BitstreamAutocorrelation,
  })

  const showNotesEnabled = showNotes === "true"

  const rootNoteIndex = useMemo(() => {
    const index = NOTE_NAMES.indexOf(key)
    return index >= 0 ? index : 9
  }, [key])

  const fullScale = useMemo(() => {
    const majorScale = getMajorScale(rootNoteIndex)
    switch (scale) {
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
  }, [rootNoteIndex, scale])

  const shapeNotes = useMemo(() => getShapeNotes(shapeIndex, fullScale), [shapeIndex, fullScale])

  const markers = useMemo(
    () => scaleNotesToMarkers(shapeNotes, playedNotes, showNotesEnabled),
    [shapeNotes, playedNotes, showNotesEnabled],
  )

  const finalizeSession = () => {
    if (!sessionRef.current) return
    sessionRef.current.endTime = Date.now()
    const stats = deriveSessionStats(sessionRef.current)
    console.log("=== Scale Practice Session Complete ===")
    console.log("Session:", sessionRef.current)
    console.log("Stats:", stats)
    setSessionState("finished")
  }

  const finalizeCurrentShape = () => {
    if (!sessionRef.current) return
    const now = Date.now()
    const shapeDuration = now - shapeStartTimeRef.current
    const frets = shapeNotes.map((n) => n.fretIndex)
    const completedShape: ScalePracticeShape = {
      shapeIndex,
      duration: shapeDuration,
      key,
      scale,
      showNotes: showNotesEnabled,
      noteCount: shapeNotes.length,
      fretRange: [Math.min(...frets), Math.max(...frets)],
    }
    sessionRef.current.shapes.push(completedShape)
  }

  const selectRandomShape = (isFirst = false) => {
    let newIndex = Math.floor(Math.random() * TOTAL_SHAPES)
    if (!isFirst) {
      while (newIndex === shapeIndex) {
        newIndex = Math.floor(Math.random() * TOTAL_SHAPES)
      }
    }
    const newShapeNotes = getShapeNotes(newIndex, fullScale)
    const newViewFrets = calculateViewFrets(newShapeNotes)
    setViewFrets(newViewFrets)
    setShapeIndex(newIndex)
    setPlayedNotes(new Set())
    lastMatchRef.current = null
    isTransitioningRef.current = false
    shapeStartTimeRef.current = Date.now()
  }

  // Countdown effect
  useEffect(() => {
    if (sessionState !== "countdown") return
    if (countdown <= 0) {
      const now = Date.now()
      sessionRef.current = {
        startTime: now,
        endTime: 0,
        showNotes: showNotesEnabled,
        scale,
        shapes: [],
      }
      shapeStartTimeRef.current = now
      setSessionState("active")
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [sessionState, countdown])

  // Session timer effect
  useEffect(() => {
    if (sessionState !== "active") return
    if (remainingMs <= 0) {
      finalizeSession()
      return
    }
    const timer = setTimeout(() => setRemainingMs((r) => r - 1000), 1000)
    return () => clearTimeout(timer)
  }, [sessionState, remainingMs])

  // Pitch detection effect
  useEffect(() => {
    if (sessionState !== "active" || pitch <= 0 || isTransitioningRef.current) return

    for (const note of shapeNotes) {
      const noteKey = createNoteKey(note.stringIndex, note.fretIndex)
      if (playedNotes.has(noteKey)) continue

      if (isFrequencyMatch(pitch, note.targetFrequency)) {
        if (lastMatchRef.current === noteKey) {
          setPlayedNotes((prev) => new Set(prev).add(noteKey))
          lastMatchRef.current = null
        } else {
          lastMatchRef.current = noteKey
        }
        break
      }
    }
  }, [sessionState, pitch])

  // Shape completion effect
  useEffect(() => {
    if (sessionState !== "active") return
    if (playedNotes.size === 0 || playedNotes.size < shapeNotes.length) return

    isTransitioningRef.current = true
    finalizeCurrentShape()
    const timeout = setTimeout(() => selectRandomShape(), SHAPE_COMPLETION_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [sessionState, playedNotes.size, shapeNotes.length])

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  if (sessionState === "countdown") {
    return (
      <ScreenContainer>
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      </ScreenContainer>
    )
  }

  if (sessionState === "finished") {
    return (
      <ScreenContainer>
        <View style={styles.finishedContainer}>
          <Text style={styles.finishedText}>Session Complete</Text>
          <Text style={styles.finishedSubtext}>Check console for results</Text>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer contentStyle={styles.container}>
      <View style={styles.timerContainer}>
        <Text style={styles.timerText}>{formatTime(remainingMs)}</Text>
      </View>
      <View style={styles.fretboardContainer}>
        <View style={styles.fretboardControlsRow}>
          <View style={styles.fretboardControlButtonContainer}>
            <Pressable
              style={buttonVariants(colors, { variant: "outline", size: "default" }).button}
              onPress={() => setViewFrets([viewFrets[0] - 1, viewFrets[1] - 1])}
              disabled={viewFrets[0] <= 0}
            >
              <ChevronLeftIcon size={20} color={colors.foreground} />
            </Pressable>
            <Text style={styles.fretboardControlText}>{viewFrets[0]}</Text>
          </View>
          <View style={styles.fretboardControlButtonContainer}>
            <Text style={styles.fretboardControlText}>{viewFrets[1]}</Text>

            <Pressable
              style={buttonVariants(colors, { variant: "outline", size: "default" }).button}
              onPress={() => setViewFrets([viewFrets[0] + 1, viewFrets[1] + 1])}
              disabled={viewFrets[1] >= 23}
            >
              <ChevronRightIcon size={20} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
        <Fretboard
          startFret={viewFrets[0]}
          endFret={viewFrets[1]}
          widthPercent={95}
          heightPercent={30}
          markers={markers}
        />
      </View>
    </ScreenContainer>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    countdownContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    countdownText: {
      fontSize: 120,
      fontWeight: "700",
      color: colors.foreground,
    },
    finishedContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    finishedText: {
      fontSize: 28,
      fontWeight: "600",
      color: colors.foreground,
    },
    finishedSubtext: {
      fontSize: 16,
      color: colors.mutedForeground,
      marginTop: 8,
    },
    timerContainer: {
      alignItems: "center",
      paddingVertical: 16,
    },
    timerText: {
      fontSize: 32,
      fontWeight: "600",
      color: colors.foreground,
    },
    fretboardContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    fretboardControlsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: 12,
    },
    fretboardControlText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    fretboardControlButtonContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    buttonText: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: "500",
    },
  })
