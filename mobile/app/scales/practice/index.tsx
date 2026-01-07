import { Fretboard } from "@/components/fretboard/fretboard"
import { ScreenContainer } from "@/components/ScreenContainer"
import { buttonVariants } from "@/components/ui/button"
import { useFastPitchDetection } from "@/lib/audio/useFastPitchDetection"
import { NOTE_NAMES, NoteName } from "@/lib/audio/utils"
import { getMajorScale, getShapeNotes, ScaleNote } from "@/lib/scales/major-scale"
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

export type ScaleType = "major" | "minor"

export type ScalePracticeParams = {
  scale: ScaleType
  key: NoteName
  showNotes: "true" | "false"
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

export default function PracticePage() {
  const colors = useColors()
  const styles = createStyles(colors)
  const { scale, key, showNotes } = useLocalSearchParams<ScalePracticeParams>()

  const [shapeIndex, setShapeIndex] = useState(0)
  const [viewFrets, setViewFrets] = useState<[number, number]>([0, 6])
  const [playedNotes, setPlayedNotes] = useState<Set<string>>(new Set())

  const lastMatchRef = useRef<string | null>(null) // since we just need 2 consecutive matches
  const isTransitioningRef = useRef(false)

  const { pitch } = useFastPitchDetection({
    minVolume: -70.0,
    updateIntervalMs: 50,
    bufferSize: 2048,
  })

  const showNotesEnabled = showNotes === "true"

  const rootNoteIndex = useMemo(() => {
    const index = NOTE_NAMES.indexOf(key)
    return index >= 0 ? index : 9
  }, [key])

  const fullScale = useMemo(() => getMajorScale(rootNoteIndex), [rootNoteIndex])

  const shapeNotes = useMemo(() => getShapeNotes(shapeIndex, fullScale), [shapeIndex, fullScale])

  const markers = useMemo(
    () => scaleNotesToMarkers(shapeNotes, playedNotes, showNotesEnabled),
    [shapeNotes, playedNotes, showNotesEnabled],
  )

  const selectRandomShape = () => {
    let newIndex = Math.floor(Math.random() * TOTAL_SHAPES)
    while (newIndex === shapeIndex) {
      newIndex = Math.floor(Math.random() * TOTAL_SHAPES)
    }
    const newViewFrets = calculateViewFrets(getShapeNotes(newIndex, fullScale))
    setViewFrets(newViewFrets)
    setShapeIndex(newIndex)
    setPlayedNotes(new Set())
    lastMatchRef.current = null
    isTransitioningRef.current = false
  }

  useEffect(() => {
    if (pitch <= 0 || isTransitioningRef.current) return

    for (const note of shapeNotes) {
      const key = createNoteKey(note.stringIndex, note.fretIndex)
      if (playedNotes.has(key)) continue

      if (isFrequencyMatch(pitch, note.targetFrequency)) {
        if (lastMatchRef.current === key) {
          setPlayedNotes((prev) => new Set(prev).add(key))
          lastMatchRef.current = null
        } else {
          lastMatchRef.current = key
        }
        break
      }
    }
  }, [pitch])

  useEffect(() => {
    if (playedNotes.size === 0 || playedNotes.size < shapeNotes.length) return

    isTransitioningRef.current = true
    const timeout = setTimeout(selectRandomShape, SHAPE_COMPLETION_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [playedNotes.size, shapeNotes.length, selectRandomShape])

  return (
    <ScreenContainer>
      <View style={styles.container}>
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
      </View>
    </ScreenContainer>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingInline: "2.5%",
      backgroundColor: colors.background,
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
