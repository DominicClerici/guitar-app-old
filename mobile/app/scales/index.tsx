import { ScaleType } from "@/app/scales/practice"
import { ScreenContainer } from "@/components/ScreenContainer"
import Button from "@/components/ui/button"
import { NOTE_NAMES, NoteName } from "@/lib/audio/utils"
import { SCALE_NAMES } from "@/lib/constants"
import { ThemeColors, useColors } from "@/lib/theme/ThemeContext"
import { useRouter } from "expo-router"
import React, { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

export default function ScalesScreen() {
  const [selectedScale, setSelectedScale] = useState<ScaleType | null>(null)
  const [selectedKey, setSelectedKey] = useState<NoteName | null>(null)
  const colors = useColors()
  const styles = createStyles(colors)
  const router = useRouter()
  return (
    <ScreenContainer contentStyle={styles.container}>
      <View style={styles.topControls}>
        <View style={styles.scaleButtons}>
          <Button
            variant={selectedScale === "major" ? "default" : "outline"}
            size="lg"
            onPress={() => setSelectedScale(selectedScale === "major" ? null : "major")}
          >
            Major
          </Button>
          <Button
            variant={selectedScale === "minor" ? "default" : "outline"}
            size="lg"
            onPress={() => setSelectedScale(selectedScale === "minor" ? null : "minor")}
          >
            Minor
          </Button>
        </View>
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
                duration: "30",
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
    scaleButtons: {
      display: "flex",
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
      height: "55%",
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
