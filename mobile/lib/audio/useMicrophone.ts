import { useState, useCallback, useRef, useEffect } from "react"
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorderState,
} from "expo-audio"
import { useFocusEffect } from "expo-router"

export type MicrophoneStatus = "idle" | "requesting" | "recording" | "error"

interface UseMicrophoneResult {
  status: MicrophoneStatus
  error: string | null
  /** Current audio metering level in dB (typically -160 to 0) */
  meteringLevel: number | null
}

const METERING_UPDATE_INTERVAL_MS = 50

export function useMicrophone(): UseMicrophoneResult {
  const [status, setStatus] = useState<MicrophoneStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const isRecordingRef = useRef(false)

  // Create recorder with metering enabled
  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  })

  // Poll recorder state for metering values
  const recorderState = useAudioRecorderState(
    audioRecorder,
    METERING_UPDATE_INTERVAL_MS
  )

  // Convert metering from 0-1 to dB scale (-160 to 0) for compatibility
  const meteringLevel =
    recorderState.metering != null && recorderState.metering > 0
      ? 20 * Math.log10(recorderState.metering)
      : recorderState.metering != null
        ? -160
        : null

  // Sync status with recorder state
  useEffect(() => {
    if (recorderState.isRecording && status === "requesting") {
      setStatus("recording")
    }
  }, [recorderState.isRecording, status])

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return

    try {
      setStatus("requesting")
      setError(null)

      // Request permissions
      const permissionStatus =
        await AudioModule.requestRecordingPermissionsAsync()
      if (!permissionStatus.granted) {
        setError("Microphone permission denied")
        setStatus("error")
        return
      }

      // Configure audio mode for recording
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      })

      // Prepare and start recording
      await audioRecorder.prepareToRecordAsync()
      audioRecorder.record()
      isRecordingRef.current = true
      setStatus("recording")
    } catch (err) {
      console.error("Failed to start recording:", err)
      setError(err instanceof Error ? err.message : "Failed to start recording")
      setStatus("error")
    }
  }, [audioRecorder])

  const stopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return

    try {
      await audioRecorder.stop()
      isRecordingRef.current = false
      await setAudioModeAsync({
        allowsRecording: false,
      })
      setStatus("idle")
    } catch (err) {
      console.error("Failed to stop recording:", err)
    }
  }, [audioRecorder])

  // Start recording when screen is focused, stop when unfocused
  useFocusEffect(
    useCallback(() => {
      startRecording()

      return () => {
        stopRecording()
      }
    }, [startRecording, stopRecording])
  )

  return {
    status,
    error,
    meteringLevel,
  }
}
