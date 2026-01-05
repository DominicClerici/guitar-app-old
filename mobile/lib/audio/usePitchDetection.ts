import { useFocusEffect } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { PermissionsAndroid, Platform } from "react-native"
import MicrophoneStreamModule, { AudioBuffer } from "../../modules/microphone-stream"
import DSPModule from "../../specs/NativeDSPModule"

export type PitchDetectionStatus = "idle" | "requesting" | "recording" | "error"

interface UsePitchDetectionResult {
  status: PitchDetectionStatus
  error: string | null
  /** Detected pitch frequency in Hz, or -1 if no pitch detected */
  pitch: number
  /** RMS level of the current audio buffer */
  rmsLevel: number
  /** Sample rate from the microphone */
  sampleRate: number
}

// YIN algorithm parameters
const BUF_SIZE = 9000
const MIN_FREQ = 60
const MAX_FREQ = 1200
const THRESHOLD = 0.15

// Circular buffer for audio samples - avoids array spreading on every callback
class AudioCircularBuffer {
  private buffer: Float32Array
  private writeHead: number = 0
  readonly capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
    this.buffer = new Float32Array(capacity)
  }

  // Append new samples to the buffer
  push(samples: number[]): void {
    const len = samples.length
    for (let i = 0; i < len; i++) {
      this.buffer[this.writeHead] = samples[i]
      this.writeHead = (this.writeHead + 1) % this.capacity
    }
  }

  // Get samples in order from oldest to newest as a regular array
  // (required for DSPModule.pitch which expects number[])
  toArray(): number[] {
    const result = new Array<number>(this.capacity)
    for (let i = 0; i < this.capacity; i++) {
      result[i] = this.buffer[(this.writeHead + i) % this.capacity]
    }
    return result
  }

  // Reset the buffer to zeros
  reset(): void {
    this.buffer.fill(0)
    this.writeHead = 0
  }
}

export function usePitchDetection(): UsePitchDetectionResult {
  const [status, setStatus] = useState<PitchDetectionStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [pitch, setPitch] = useState<number>(-1)
  const [rmsLevel, setRmsLevel] = useState<number>(0)
  const [sampleRate, setSampleRate] = useState<number>(44100)

  // Audio buffer accumulator - uses circular buffer to avoid array allocation on each callback
  const audioBufferRef = useRef<AudioCircularBuffer>(new AudioCircularBuffer(BUF_SIZE))

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

  const startRecording = useCallback(async () => {
    try {
      setStatus("requesting")
      setError(null)

      const hasPermission = await requestPermissions()
      if (!hasPermission) {
        setError("Microphone permission denied")
        setStatus("error")
        return
      }

      MicrophoneStreamModule.startRecording()

      // Get sample rate after starting (iOS needs audio engine running)
      setTimeout(() => {
        const sr = MicrophoneStreamModule.getSampleRate()
        setSampleRate(sr)
        console.log(`[PitchDetection] Sample rate: ${sr}Hz`)
      }, 100)

      setStatus("recording")
    } catch (err) {
      console.error("Failed to start recording:", err)
      setError(err instanceof Error ? err.message : "Failed to start recording")
      setStatus("error")
    }
  }, [requestPermissions])

  const stopRecording = useCallback(() => {
    try {
      MicrophoneStreamModule.stopRecording()
      setStatus("idle")
      setPitch(-1)
      setRmsLevel(0)
      audioBufferRef.current.reset()
    } catch (err) {
      console.error("Failed to stop recording:", err)
    }
  }, [])

  // Process incoming audio buffers
  useEffect(() => {
    if (status !== "recording") return

    const subscription = MicrophoneStreamModule.addListener(
      "onAudioBuffer",
      (buffer: AudioBuffer) => {
        const samples = buffer.samples

        // Append new samples to the circular buffer (no array allocation)
        audioBufferRef.current.push(samples)

        // Calculate RMS of the new samples
        const rms = DSPModule.rms(samples)
        setRmsLevel(rms)

        // Only run pitch detection if we have enough signal
        if (rms > 0.0004) {
          const detectedPitch = DSPModule.pitch(
            audioBufferRef.current.toArray(),
            sampleRate,
            MIN_FREQ,
            MAX_FREQ,
            THRESHOLD,
          )
          setPitch(detectedPitch)
        } else {
          setPitch(-1)
        }
      },
    )

    return () => {
      subscription.remove()
    }
  }, [status, sampleRate])

  // Start recording when screen is focused, stop when unfocused
  useFocusEffect(
    useCallback(() => {
      startRecording()

      return () => {
        stopRecording()
      }
    }, [startRecording, stopRecording]),
  )

  return {
    status,
    error,
    pitch,
    rmsLevel,
    sampleRate,
  }
}
