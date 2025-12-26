import { StyleSheet } from "react-native"
import { theme } from "./theme"

/**
 * Shared styles for fretboard-based screens (scales, note-trainer, etc.)
 */
export const fretboardScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingLeft: "7.5%",
    paddingRight: "5%",
    paddingTop: "2%",
    paddingBottom: "2.5%",
  },
  fretboardContainer: {
    flex: 1,
    marginTop: "auto",
    maxHeight: "65%",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingBottom: "2%",
  },
  backButton: {
    padding: 8,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: theme.colors.muted,
    borderRadius: 8,
    overflow: "hidden",
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modeButtonActive: {
    backgroundColor: "#007AFF",
  },
  modeButtonText: {
    color: theme.colors.mutedForeground,
    fontSize: 14,
    fontWeight: "600",
  },
  modeButtonTextActive: {
    color: theme.colors.primary,
  },
  noteSelectContainer: {
    position: "relative",
  },
  noteSelect: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  noteSelectText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  notePicker: {
    position: "absolute",
    top: "100%",
    left: 0,
    backgroundColor: theme.colors.muted,
    borderRadius: 8,
    marginTop: 4,
    zIndex: 100,
  },
  notePickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  notePickerItemActive: {
    backgroundColor: theme.colors.muted,
  },
  notePickerItemText: {
    color: theme.colors.primary,
    fontSize: 16,
  },
  notePickerItemTextActive: {
    fontWeight: "600",
  },
  practiceControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  startButton: {
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  stopButton: {
    backgroundColor: "#ef4444",
  },
  startButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  rotateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    paddingHorizontal: 40,
  },
  rotateIcon: {
    marginBottom: 24,
  },
  rotateTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: theme.colors.primary,
    marginBottom: 12,
  },
  rotateSubtitle: {
    fontSize: 16,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    marginBottom: 32,
  },
  rotateButton: {
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  rotateButtonText: {
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: "600",
  },
  transitionDisplay: {
    backgroundColor: "#22c55e22",
    borderColor: "#22c55e",
    borderWidth: 1,
  },
  progressText: {
    color: theme.colors.mutedForeground,
    fontSize: 12,
  },
})
