"use client"

import { useCallback, useRef, useState } from "react"

export type RecordingPhase =
  | "idle"
  | "waiting-for-silence"
  | "ready-to-pluck"
  | "recording"
  | "waiting-for-mute"

export type SessionState = "idle" | "recording" | "preview"

export interface RecordedSample {
  index: number
  audioData: Float32Array
  sampleRate: number
}

interface UseSampleRecorderOptions {
  samplesPerSession?: number
  recordDurationMs?: number
  preRollDurationMs?: number
  silenceThreshold?: number
  pluckThreshold?: number
}

export interface TrimOptions {
  trimStartMs: number
  trimEndMs: number
}

interface UseSampleRecorderResult {
  sessionState: SessionState
  recordingPhase: RecordingPhase
  currentSampleIndex: number
  samples: RecordedSample[]
  error: string | null
  isClipping: boolean
  startSession: () => Promise<void>
  stopSession: () => void
  discardSession: () => void
  getSampleBlob: (sample: RecordedSample) => Blob
  getTrimmedSampleBlob: (sample: RecordedSample, options: TrimOptions) => Blob
}

const DEFAULT_SAMPLES_PER_SESSION = 5
const DEFAULT_RECORD_DURATION_MS = 675
const DEFAULT_PRE_ROLL_DURATION_MS = 125
const DEFAULT_SILENCE_THRESHOLD = 0.001
const DEFAULT_PLUCK_THRESHOLD = 0.05

export function useSampleRecorder(options: UseSampleRecorderOptions = {}): UseSampleRecorderResult {
  const samplesPerSession = options.samplesPerSession ?? DEFAULT_SAMPLES_PER_SESSION
  const recordDurationMs = options.recordDurationMs ?? DEFAULT_RECORD_DURATION_MS
  const preRollDurationMs = options.preRollDurationMs ?? DEFAULT_PRE_ROLL_DURATION_MS
  const silenceThreshold = options.silenceThreshold ?? DEFAULT_SILENCE_THRESHOLD
  const pluckThreshold = options.pluckThreshold ?? DEFAULT_PLUCK_THRESHOLD

  const [sessionState, setSessionState] = useState<SessionState>("idle")
  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>("idle")
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0)
  const [samples, setSamples] = useState<RecordedSample[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isClipping, setIsClipping] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const stopRequestedRef = useRef(false)
  const recordingResolveRef = useRef<((data: Float32Array | null) => void) | null>(null)
  const clippingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clippingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    stopRequestedRef.current = true

    if (clippingTimeoutRef.current) {
      clearTimeout(clippingTimeoutRef.current)
      clippingTimeoutRef.current = null
    }

    if (clippingIntervalRef.current) {
      clearInterval(clippingIntervalRef.current)
      clippingIntervalRef.current = null
    }

    const worklet = workletNodeRef.current
    if (worklet) {
      worklet.port.postMessage({ type: "cancel" })
      worklet.disconnect()
      workletNodeRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    analyserRef.current = null
    recordingResolveRef.current = null
  }, [])

  const checkClipping = useCallback((dataArray: Float32Array) => {
    const clipThreshold = 0.99
    for (let i = 0; i < dataArray.length; i++) {
      if (Math.abs(dataArray[i]) >= clipThreshold) {
        if (clippingTimeoutRef.current) {
          clearTimeout(clippingTimeoutRef.current)
        }
        setIsClipping(true)
        clippingTimeoutRef.current = setTimeout(() => {
          setIsClipping(false)
          clippingTimeoutRef.current = null
        }, 1000)
        return
      }
    }
  }, [])

  const pollClipping = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return

    const dataArray = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(dataArray)
    checkClipping(dataArray)
  }, [checkClipping])

  const handleWorkletMessage = useCallback((event: MessageEvent) => {
    const { type, data } = event.data

    if (type === "phase-change") {
      if (data.phase === "ready-to-pluck") {
        setRecordingPhase("ready-to-pluck")
      } else if (data.phase === "recording") {
        setRecordingPhase("recording")
      }
    } else if (type === "recording-complete" && recordingResolveRef.current) {
      recordingResolveRef.current(data.audioData)
      recordingResolveRef.current = null
    }
  }, [])

  const recordSample = useCallback(
    (sampleRate: number): Promise<RecordedSample | null> => {
      return new Promise((resolve) => {
        const worklet = workletNodeRef.current
        if (!worklet) {
          resolve(null)
          return
        }

        const preRollSamples = Math.ceil((preRollDurationMs / 1000) * sampleRate)
        const samplesToRecord = Math.ceil((recordDurationMs / 1000) * sampleRate)

        recordingResolveRef.current = (audioData) => {
          if (!audioData) {
            resolve(null)
            return
          }

          resolve({
            index: 0,
            audioData,
            sampleRate,
          })
        }

        worklet.port.postMessage({
          type: "start-capture",
          data: {
            preRollSamples,
            samplesToRecord,
            silenceThreshold,
            pluckThreshold,
          },
        })
      })
    },
    [preRollDurationMs, recordDurationMs, silenceThreshold, pluckThreshold],
  )

  const cancelCapture = useCallback(() => {
    const worklet = workletNodeRef.current
    if (worklet) {
      worklet.port.postMessage({ type: "cancel" })
    }
    recordingResolveRef.current = null
  }, [])

  const runRecordingLoop = useCallback(
    async (sampleRate: number) => {
      const collectedSamples: RecordedSample[] = []

      // Start clipping detection polling (just for UI feedback)
      clippingIntervalRef.current = setInterval(pollClipping, 50)

      for (let i = 0; i < samplesPerSession; i++) {
        if (stopRequestedRef.current) break

        setCurrentSampleIndex(i)
        setRecordingPhase("waiting-for-silence")

        // Worklet handles silence detection, pluck detection, and recording
        // It sends phase-change messages to update the UI
        const sample = await recordSample(sampleRate)

        if (stopRequestedRef.current) {
          cancelCapture()
          break
        }

        if (sample) {
          collectedSamples.push({ ...sample, index: i })
        }

        if (i < samplesPerSession - 1) {
          setRecordingPhase("waiting-for-mute")
        }
      }

      if (!stopRequestedRef.current) {
        setSamples(collectedSamples)
        setSessionState("preview")
        setRecordingPhase("idle")
      }

      cleanup()
    },
    [samplesPerSession, recordSample, cancelCapture, cleanup, pollClipping],
  )

  const startSession = useCallback(async () => {
    try {
      setError(null)
      setSamples([])
      setCurrentSampleIndex(0)
      stopRequestedRef.current = false

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

      mediaStreamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      await audioContext.audioWorklet.addModule("/audio-recorder-worklet.js")

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const workletNode = new AudioWorkletNode(audioContext, "audio-recorder-processor")
      workletNodeRef.current = workletNode
      workletNode.port.onmessage = handleWorkletMessage

      source.connect(workletNode)
      workletNode.connect(audioContext.destination)

      setSessionState("recording")
      runRecordingLoop(audioContext.sampleRate)
    } catch (err) {
      console.error("Failed to start recording session:", err)
      setError(err instanceof Error ? err.message : "Failed to start recording")
      cleanup()
    }
  }, [runRecordingLoop, cleanup, handleWorkletMessage])

  const stopSession = useCallback(() => {
    stopRequestedRef.current = true
    cleanup()
    setSessionState("idle")
    setRecordingPhase("idle")
    setSamples([])
  }, [cleanup])

  const discardSession = useCallback(() => {
    setSamples([])
    setCurrentSampleIndex(0)
    setSessionState("idle")
    setRecordingPhase("idle")
  }, [])

  const createWavBlob = useCallback(
    (audioData: Float32Array, sampleRate: number): Blob => {
      const numChannels = 1
      const bytesPerSample = 2
      const dataLength = audioData.length * bytesPerSample
      const buffer = new ArrayBuffer(44 + dataLength)
      const view = new DataView(buffer)

      // Remove DC offset
      const mean = audioData.reduce((a, b) => a + b, 0) / audioData.length
      const dcCorrectedData = new Float32Array(audioData.length)
      for (let i = 0; i < audioData.length; i++) {
        dcCorrectedData[i] = audioData[i] - mean
      }

      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i))
        }
      }

      writeString(0, "RIFF")
      view.setUint32(4, 36 + dataLength, true)
      writeString(8, "WAVE")
      writeString(12, "fmt ")
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true)
      view.setUint16(22, numChannels, true)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
      view.setUint16(32, numChannels * bytesPerSample, true)
      view.setUint16(34, bytesPerSample * 8, true)
      writeString(36, "data")
      view.setUint32(40, dataLength, true)

      // Apply a short fade-out to prevent end-of-sample pops
      const fadeOutSamples = Math.min(Math.floor(sampleRate * 0.01), dcCorrectedData.length)
      const fadeOutStart = dcCorrectedData.length - fadeOutSamples

      let offset = 44
      for (let i = 0; i < dcCorrectedData.length; i++) {
        let s = Math.max(-1, Math.min(1, dcCorrectedData[i]))

        if (i >= fadeOutStart) {
          const fadeProgress = (i - fadeOutStart) / fadeOutSamples
          s *= 1 - fadeProgress
        }

        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
        offset += 2
      }

      return new Blob([buffer], { type: "audio/wav" })
    },
    [],
  )

  const getSampleBlob = useCallback(
    (sample: RecordedSample): Blob => {
      return createWavBlob(sample.audioData, sample.sampleRate)
    },
    [createWavBlob],
  )

  const getTrimmedSampleBlob = useCallback(
    (sample: RecordedSample, options: TrimOptions): Blob => {
      const startSample = Math.floor((options.trimStartMs / 1000) * sample.sampleRate)
      const endSample = Math.floor((options.trimEndMs / 1000) * sample.sampleRate)

      const clampedStart = Math.max(0, Math.min(startSample, sample.audioData.length))
      const clampedEnd = Math.max(clampedStart, Math.min(endSample, sample.audioData.length))

      const trimmedData = sample.audioData.slice(clampedStart, clampedEnd)
      return createWavBlob(trimmedData, sample.sampleRate)
    },
    [createWavBlob],
  )

  return {
    sessionState,
    recordingPhase,
    currentSampleIndex,
    samples,
    error,
    isClipping,
    startSession,
    stopSession,
    discardSession,
    getSampleBlob,
    getTrimmedSampleBlob,
  }
}
