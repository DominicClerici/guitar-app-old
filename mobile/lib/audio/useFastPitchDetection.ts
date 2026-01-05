import { useFocusEffect } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { PermissionsAndroid, Platform } from "react-native"
import PitchDetectionModule, { PitchEvent } from "../../modules/pitch-detection"

export type PitchDetectionStatus = "idle" | "requesting" | "recording" | "error"

interface UseFastPitchDetectionOptions {
  /** Buffer size for audio capture. Default: 4096 */
  bufferSize?: number
  /** Minimum volume in decibels to trigger detection. Default: -20.0 */
  minVolume?: number
  /** Update interval in milliseconds. Default: 50 */
  updateIntervalMs?: number
}

interface UseFastPitchDetectionResult {
  status: PitchDetectionStatus
  error: string | null
  /** Detected pitch frequency in Hz, or -1 if no pitch detected */
  pitch: number
  /** Sample rate from the microphone */
  sampleRate: number
}

const DEFAULT_OPTIONS: Required<UseFastPitchDetectionOptions> = {
  bufferSize: 4096,
  minVolume: -70.0,
  updateIntervalMs: 46.5,
}

export function useFastPitchDetection(
  options: UseFastPitchDetectionOptions = {},
): UseFastPitchDetectionResult {
  const [status, setStatus] = useState<PitchDetectionStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [pitch, setPitch] = useState<number>(-1)
  const [sampleRate, setSampleRate] = useState<number>(44100)

  const optionsRef = useRef({ ...DEFAULT_OPTIONS, ...options })

  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = { ...DEFAULT_OPTIONS, ...options }
  }, [options])

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Microphone Permission",
          message: "This app needs access to your microphone for pitch detection.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK",
        },
      )
      return granted === PermissionsAndroid.RESULTS.GRANTED
    }
    // iOS permissions are handled by the native module
    return true
  }, [])

  const startListening = useCallback(async () => {
    try {
      setStatus("requesting")
      setError(null)

      const hasPermission = await requestPermissions()
      if (!hasPermission) {
        setError("Microphone permission denied")
        setStatus("error")
        return
      }

      // Configure options before starting
      const { bufferSize, minVolume, updateIntervalMs } = optionsRef.current
      PitchDetectionModule.setOptions(bufferSize, minVolume, updateIntervalMs)

      await PitchDetectionModule.startListening()

      // Get sample rate after starting
      setTimeout(() => {
        const sr = PitchDetectionModule.getSampleRate()
        setSampleRate(sr)
        console.log(`[FastPitchDetection] Sample rate: ${sr}Hz`)
      }, 100)

      setStatus("recording")
    } catch (err) {
      console.error("Failed to start listening:", err)
      setError(err instanceof Error ? err.message : "Failed to start listening")
      setStatus("error")
    }
  }, [requestPermissions])

  const stopListening = useCallback(async () => {
    try {
      await PitchDetectionModule.stopListening()
      setStatus("idle")
      setPitch(-1)
    } catch (err) {
      // Ignore "not listening" errors when stopping
      console.log("Stop listening:", err)
    }
  }, [])

  // Listen for pitch detection events
  useEffect(() => {
    if (status !== "recording") return

    const subscription = PitchDetectionModule.addListener(
      "onPitchDetected",
      (event: PitchEvent) => {
        setPitch(event.frequency)
      },
    )

    return () => {
      subscription.remove()
    }
  }, [status])

  // Start listening when screen is focused, stop when unfocused
  useFocusEffect(
    useCallback(() => {
      startListening()

      return () => {
        stopListening()
      }
    }, [startListening, stopListening]),
  )

  return {
    status,
    error,
    pitch,
    sampleRate,
  }
}
