import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import React from "react"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"

const DEFAULT_TUNING = ["E", "A", "D", "G", "B", "E"] as const
const STRING_THICKNESSES = [3.5, 3, 2.5, 2, 1.5, 1]
const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]
const STRING_COUNT = 6

type MarkerType =
  | "root-disabled"
  | "root"
  | "note-disabled"
  | "note"
  | "root-hidden"
  | "note-hidden"

type Marker = {
  stringIndex: number
  fretIndex: number
  type: MarkerType
  label: string
}

type FretboardProps = {
  startFret: number
  endFret: number
  widthPercent?: number
  heightPercent?: number
  tuning?: readonly string[]
  markers?: Marker[]
}

export function Fretboard({
  startFret,
  endFret,
  widthPercent = 100,
  heightPercent = 100,
  tuning = DEFAULT_TUNING,
  markers = [],
}: FretboardProps) {
  const colors = useColors()
  const styles = createStyles(colors)
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()

  const containerWidth = (screenWidth * widthPercent) / 100
  const containerHeight = (screenHeight * heightPercent) / 100

  const fretCount = endFret - startFret + 1
  const fretWidth = containerWidth / fretCount
  const stringSpacing = containerHeight / (STRING_COUNT + 1)

  const frets = Array.from({ length: fretCount }, (_, i) => startFret + i)

  const getMarkerColors = (type: MarkerType) => {
    const isHidden = type.includes("hidden")
    const isDisabled = type.includes("disabled")
    const isRoot = type.includes("root")
    return {
      background: isRoot ? colors.primary : colors.foreground,
      text: isRoot ? colors.primaryForeground : colors.background,
      opacity: isHidden ? 0 : isDisabled ? 0.4 : 1,
    }
  }

  const renderMarker = (marker: Marker, index: number) => {
    const fretPositionIndex = marker.fretIndex - startFret
    if (fretPositionIndex < 0 || fretPositionIndex >= fretCount) return null

    const markerColors = getMarkerColors(marker.type)
    const markerSize = 28
    const left = fretPositionIndex * fretWidth + fretWidth / 2 - markerSize / 2
    const top = stringSpacing * (STRING_COUNT - marker.stringIndex) - markerSize / 2

    return (
      <View
        key={`${marker.stringIndex}-${marker.fretIndex}-${index}`}
        style={[
          styles.marker,
          {
            left,
            top,
            width: markerSize,
            height: markerSize,
            borderRadius: markerSize / 2,
            backgroundColor: markerColors.background,
            opacity: markerColors.opacity,
          },
        ]}
      >
        <Text style={[styles.markerLabel, { color: markerColors.text }]}>{marker.label}</Text>
      </View>
    )
  }

  const renderFret = (fretNumber: number) => {
    const isNut = fretNumber === 1
    const hasMarker = fretMarkers.includes(fretNumber)

    return (
      <View key={fretNumber} style={[styles.fretContainer, { width: fretWidth }]}>
        <View
          style={[
            styles.fretWire,
            {
              backgroundColor: isNut ? colors.foreground : colors.muted,
              width: isNut ? 6 : fretNumber === 0 ? 0 : 2,
            },
          ]}
        />

        <View style={styles.fretArea}>
          {hasMarker && (
            <>
              {fretNumber === 12 ? (
                <>
                  <View
                    style={[
                      styles.fretMarker,
                      {
                        top: containerHeight / 3 - 6,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.fretMarker,
                      {
                        top: (containerHeight * 2) / 3 - 6,
                      },
                    ]}
                  />
                </>
              ) : (
                <View style={styles.fretMarker} />
              )}
            </>
          )}
        </View>
      </View>
    )
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: containerWidth,
          height: containerHeight,
        },
      ]}
    >
      <View style={styles.fretsContainer}>{frets.map(renderFret)}</View>

      <View style={[StyleSheet.absoluteFill, styles.stringsContainer]}>
        {tuning.map((_, stringIndex) => (
          <View
            key={stringIndex}
            style={[
              styles.string,
              {
                top: stringSpacing * (STRING_COUNT - stringIndex),
                height: STRING_THICKNESSES[stringIndex],
                width: startFret === 0 ? containerWidth - fretWidth : containerWidth,
              },
            ]}
          />
        ))}
      </View>

      {startFret === 0 && (
        <View style={[StyleSheet.absoluteFill, styles.stringLabelsContainer]}>
          {tuning.map((note, stringIndex) => (
            <Text
              key={stringIndex}
              style={[
                styles.stringLabel,
                {
                  top: stringSpacing * (STRING_COUNT - stringIndex) - 8,
                  left: fretWidth / 2 - 8,
                },
              ]}
            >
              {note}
            </Text>
          ))}
        </View>
      )}

      <View style={[StyleSheet.absoluteFill, styles.markersContainer]}>
        {markers.map(renderMarker)}
      </View>
    </View>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: "relative",
      overflow: "hidden",
      borderTopWidth: 1,
      borderColor: colors.border,
      borderBottomWidth: 1,
    },
    fretsContainer: {
      flex: 1,
      flexDirection: "row",
    },
    fretContainer: {
      height: "100%",
      position: "relative",
    },
    fretWire: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
    },
    fretArea: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    fretMarker: {
      backgroundColor: colors.muted,
      position: "absolute",
      width: 12,
      height: 12,
      borderRadius: 6,
      opacity: 0.5,
    },
    stringsContainer: {
      pointerEvents: "none",
    },
    string: {
      position: "absolute",
      right: 0,
      backgroundColor: colors.muted,
    },
    stringLabelsContainer: {
      pointerEvents: "none",
    },
    stringLabel: {
      position: "absolute",
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
      width: 16,
      textAlign: "center",
    },
    markersContainer: {
      pointerEvents: "none",
    },
    marker: {
      position: "absolute",
      justifyContent: "center",
      alignItems: "center",
    },
    markerLabel: {
      fontSize: 12,
      fontWeight: "700",
    },
  })
