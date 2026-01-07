import { Fretboard } from "@/components/fretboard/fretboard"
import { ScreenContainer } from "@/components/ScreenContainer"
import { buttonVariants } from "@/components/ui/button"
import { NOTE_NAMES, NoteName } from "@/lib/audio/utils"
import { getMajorScale, getNoteName, getShapeNotes, ScaleNote } from "@/lib/scales/major-scale"
import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import { useLocalSearchParams } from "expo-router"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react-native"
import React, { useEffect, useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

export type ScaleType = "major"

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

function scaleNotesToMarkers(notes: ScaleNote[]): Marker[] {
  return notes.map((note) => ({
    stringIndex: note.stringIndex,
    fretIndex: note.fretIndex,
    type: note.degree === 1 ? "root" : "note",
    label: getNoteName(note.noteIndex),
  }))
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

export default function PracticePage() {
  const colors = useColors()
  const styles = createStyles(colors)
  const { scale, key, showNotes } = useLocalSearchParams<ScalePracticeParams>()

  const [shapeIndex, setShapeIndex] = useState(0)
  const [viewFrets, setViewFrets] = useState<[number, number]>([0, 6])

  const rootNoteIndex = useMemo(() => {
    const index = NOTE_NAMES.indexOf(key)
    return index >= 0 ? index : 9 // Default to A if not found
  }, [key])

  const fullScale = useMemo(() => getMajorScale(rootNoteIndex), [rootNoteIndex])

  const shapeNotes = useMemo(() => getShapeNotes(shapeIndex, fullScale), [shapeIndex, fullScale])

  const markers = useMemo(() => scaleNotesToMarkers(shapeNotes), [shapeNotes])

  useEffect(() => {
    const newViewFrets = calculateViewFrets(shapeNotes)
    setViewFrets(newViewFrets)
  }, [shapeNotes])

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
    fretboardControlButton: {
      width: 40,
      height: 40,
      padding: 0,
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
