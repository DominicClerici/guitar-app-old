import { requestRecordingPermissionsAsync } from "expo-audio"
import { useCallback, useRef, useState } from "react"

import PitchDetection from "@techoptio/react-native-live-pitch-detection"

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
const A4_FREQUENCY = 440

export type NoteName = (typeof NOTE_NAMES)[number]

export interface DetectedNote {
  note: NoteName
  octave: number
  frequency: number
  targetFrequency: number
  cents: number
}

export interface UsePitchDetectionOptions {
  /** Buffer size for pitch detection (default: 2048) */
  bufferSize?: number
  /** Minimum volume threshold in dB (default: -60) */
  minVolume?: number
  /** Update interval in milliseconds (default: 8) */
  updateIntervalMs?: number
  /** A4 reference frequency (default: 440) */
  a4Frequency?: number
  /** Callback when a note is detected */
  onNoteDetected?: (note: DetectedNote) => void
  /** Callback when no note is detected (silence or unclear pitch) */
  onNoNote?: () => void
}

export interface UsePitchDetectionReturn {
  /** Whether the hook has microphone permission */
  hasPermission: boolean | null
  /** Whether the hook is currently listening */
  isListening: boolean
  /** The currently detected note (null if none) */
  currentNote: DetectedNote | null
  /** Start listening for pitch */
  startListening: () => Promise<void>
  /** Stop listening for pitch */
  stopListening: () => Promise<void>
  /** Request microphone permission */
  requestPermission: () => Promise<boolean>
}

function parseNoteFromLibrary(noteString: string): { noteName: NoteName; octave: number } | null {
  if (!noteString || noteString === "-") return null

  // Library returns notes like "C4", "A#3", "Db5"
  const match = noteString.match(/^([A-G][#b]?)(\d+)$/)
  if (!match) return null

  let noteName = match[1]
  const octave = parseInt(match[2], 10)

  // Convert flats to sharps for consistency
  if (noteName.includes("b")) {
    const flatToSharp: Record<string, string> = {
      Db: "C#",
      Eb: "D#",
      Gb: "F#",
      Ab: "G#",
      Bb: "A#",
    }
    noteName = flatToSharp[noteName] || noteName
  }

  return { noteName: noteName as NoteName, octave }
}

function getNoteFrequency(noteName: NoteName, octave: number): number {
  const noteIndex = NOTE_NAMES.indexOf(noteName)
  if (noteIndex === -1) return 0

  // A4 is at index 9, octave 4
  // Calculate semitones from A4
  const semitonesFromA4 = (octave - 4) * 12 + (noteIndex - 9)
  return A4_FREQUENCY * Math.pow(2, semitonesFromA4 / 12)
}

function calculateCents(detectedFreq: number, targetFreq: number): number {
  if (targetFreq <= 0 || detectedFreq <= 0) return 0
  return 1200 * Math.log2(detectedFreq / targetFreq)
}

export function usePitchDetection(options: UsePitchDetectionOptions = {}): UsePitchDetectionReturn {
  const {
    bufferSize = 2048,
    minVolume = -60,
    updateIntervalMs = 8,
    a4Frequency = A4_FREQUENCY,
    onNoteDetected,
    onNoNote,
  } = options

  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [currentNote, setCurrentNote] = useState<DetectedNote | null>(null)

  const subscriptionRef = useRef<{ remove: () => void } | null>(null)
  const onNoteDetectedRef = useRef(onNoteDetected)
  const onNoNoteRef = useRef(onNoNote)

  // Keep refs updated
  onNoteDetectedRef.current = onNoteDetected
  onNoNoteRef.current = onNoNote

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { granted } = await requestRecordingPermissionsAsync()
      setHasPermission(granted)
      return granted
    } catch (error) {
      console.error("[usePitchDetection] Permission request failed:", error)
      setHasPermission(false)
      return false
    }
  }, [])

  const startListening = useCallback(async (): Promise<void> => {
    try {
      // Request permission if not already granted
      if (hasPermission === null) {
        const granted = await requestPermission()
        if (!granted) return
      } else if (hasPermission === false) {
        console.warn("[usePitchDetection] Microphone permission not granted")
        return
      }

      // Stop any existing listener
      try {
        await PitchDetection.stopListening()
      } catch {
        // Ignore - may not have been listening
      }

      await new Promise((resolve) => setTimeout(resolve, 200))

      PitchDetection.setOptions({
        bufferSize,
        minVolume,
        updateIntervalMs,
        a4Frequency,
      })

      await new Promise((resolve) => setTimeout(resolve, 200))
      await PitchDetection.startListening()

      setIsListening(true)

      subscriptionRef.current = PitchDetection.addListener((event) => {
        const parsed = parseNoteFromLibrary(event.note)

        if (parsed && event.frequency > 0) {
          const targetFreq = getNoteFrequency(parsed.noteName, parsed.octave)
          const cents = calculateCents(event.frequency, targetFreq)

          const detectedNote: DetectedNote = {
            note: parsed.noteName,
            octave: parsed.octave,
            frequency: event.frequency,
            targetFrequency: targetFreq,
            cents,
          }

          setCurrentNote(detectedNote)
          onNoteDetectedRef.current?.(detectedNote)
        } else {
          setCurrentNote(null)
          onNoNoteRef.current?.()
        }
      })
    } catch (error) {
      console.error("[usePitchDetection] Start listening failed:", error)
      setIsListening(false)
    }
  }, [hasPermission, requestPermission, bufferSize, minVolume, updateIntervalMs, a4Frequency])

  const stopListening = useCallback(async (): Promise<void> => {
    try {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove()
        subscriptionRef.current = null
      }
      await PitchDetection.stopListening()
      setIsListening(false)
      setCurrentNote(null)
    } catch (error) {
      console.error("[usePitchDetection] Stop listening failed:", error)
    }
  }, [])

  return {
    hasPermission,
    isListening,
    currentNote,
    startListening,
    stopListening,
    requestPermission,
  }
}
