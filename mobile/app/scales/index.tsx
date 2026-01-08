import { ScreenContainer } from "@/components/ScreenContainer"
import Button from "@/components/ui/button"
import { NOTE_NAMES, NoteName } from "@/lib/audio/utils"
import { SCALE_NAMES, ScaleType } from "@/lib/constants"
import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import { useRouter } from "expo-router"
import React, { useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"

export default function ScalesScreen() {
  const [selectedScale, setSelectedScale] = useState<ScaleType | null>(null)
  const [selectedKey, setSelectedKey] = useState<NoteName | null>(null)
  const colors = useColors()
  const styles = createStyles(colors)
  const router = useRouter()
  return (
    <ScreenContainer contentStyle={styles.container} topBarTitle="Scales">
      <View style={styles.topControls}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{
            flexGrow: 0,
            width: "105%",
          }}
          contentContainerStyle={{
            paddingRight: "5%",
          }}
        >
          <View style={styles.scaleButtonsContainer}>
            {[0, 1].map((rowIndex) => {
              const scales = Object.keys(SCALE_NAMES)
              const half = Math.ceil(scales.length / 2)
              const rowScales = rowIndex === 0 ? scales.slice(0, half) : scales.slice(half)
              return (
                <View key={rowIndex} style={styles.scaleButtonsRow}>
                  {rowScales.map((scale) => (
                    <Button
                      key={scale}
                      variant={selectedScale === (scale as ScaleType) ? "default" : "outline"}
                      size="lg"
                      onPress={() =>
                        setSelectedScale(
                          selectedScale === (scale as ScaleType) ? null : (scale as ScaleType),
                        )
                      }
                    >
                      {SCALE_NAMES[scale as ScaleType]}
                    </Button>
                  ))}
                </View>
              )
            })}
          </View>
        </ScrollView>
        <View style={styles.separator}></View>
        <View style={styles.scaleButtons}>
          {NOTE_NAMES.map((note) => (
            <Button
              key={note}
              variant={selectedKey === note ? "default" : "outline"}
              size="icon"
              style={{ width: "15.4166%", paddingInline: 0 }}
              onPress={() => setSelectedKey(selectedKey === note ? null : note)}
            >
              {note}
            </Button>
          ))}
        </View>
      </View>
      <View style={styles.bottomControls}>
        <View style={styles.bottomControlsInfo}>
          <Text style={styles.scaleName}>
            {selectedScale
              ? selectedKey
                ? `${selectedKey} ${SCALE_NAMES[selectedScale]}`
                : "Select a key"
              : "Select a scale"}
          </Text>
          <Text style={styles.scaleDescription}>
            We are going to show cool info here about recent practice sessions speed, count idk.
          </Text>
        </View>

        <Button
          variant="default"
          size="lg"
          style={{ marginTop: "auto" }}
          disabled={!selectedScale || !selectedKey}
          onPress={() => {
            if (!selectedScale || !selectedKey) return
            router.push({
              pathname: "/scales/practice",
              params: {
                scale: selectedScale,
                key: "C",
                showNotes: "true",
                duration: "120",
              },
            })
          }}
        >
          Start
        </Button>
      </View>
    </ScreenContainer>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    topControls: {
      width: "100%",
      flexGrow: 1,
      justifyContent: "center",
      gap: 16,
    },
    separator: {
      width: "100%",
      height: 1,
      backgroundColor: colors.border,
    },
    scaleButtonsContainer: {
      flexDirection: "column",
      gap: 8,
    },
    scaleButtonsRow: {
      flexDirection: "row",
      gap: 8,
    },
    scaleButtons: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "1.25%",
    },
    bottomControls: {
      width: "100%",
      backgroundColor: colors.backgroundElevated,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: "55%",
      flexGrow: 1,
    },
    bottomControlsInfo: {
      paddingInline: 12,
      paddingTop: 8,
    },
    scaleName: {
      marginRight: "auto",
      color: colors.foreground,
      fontSize: 24,
      fontWeight: "bold",
      textAlign: "center",
    },
    scaleDescription: {
      color: colors.mutedForeground,
      fontSize: 14,
    },
  })
