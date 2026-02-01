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

interface UseSampleRecorderResult {
  sessionState: SessionState
  recordingPhase: RecordingPhase
  currentSampleIndex: number
  samples: RecordedSample[]
  error: string | null
  startSession: () => Promise<void>
  stopSession: () => void
  discardSession: () => void
  getSampleBlob: (sample: RecordedSample) => Blob
}

const DEFAULT_SAMPLES_PER_SESSION = 10
const DEFAULT_RECORD_DURATION_MS = 750
const DEFAULT_PRE_ROLL_DURATION_MS = 50
const DEFAULT_SILENCE_THRESHOLD = 0.02
const DEFAULT_PLUCK_THRESHOLD = 0.02

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

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const recordingBufferRef = useRef<Float32Array[]>([])
  const preRollBufferRef = useRef<Float32Array[]>([])
  const preRollSamplesNeededRef = useRef(0)
  const isCapturingPreRollRef = useRef(false)
  const isRecordingRef = useRef(false)
  const animationFrameRef = useRef<number | null>(null)
  const stopRequestedRef = useRef(false)

  const cleanup = useCallback(() => {
    stopRequestedRef.current = true

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
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
  }, [])

  const getAmplitude = useCallback((): number => {
    const analyser = analyserRef.current
    if (!analyser) return 0

    const dataArray = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(dataArray)

    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += Math.abs(dataArray[i])
    }
    return sum / dataArray.length
  }, [])

  const recordSample = useCallback(
    async (
      sampleRate: number,
      preRollData: Float32Array | null,
    ): Promise<RecordedSample | null> => {
      return new Promise((resolve) => {
        const processor = processorRef.current
        if (!processor) {
          resolve(null)
          return
        }

        recordingBufferRef.current = []
        isRecordingRef.current = true

        const samplesToRecord = Math.ceil((recordDurationMs / 1000) * sampleRate)
        let samplesRecorded = 0

        const handleAudioProcess = (e: AudioProcessingEvent) => {
          if (!isRecordingRef.current) return

          const inputData = e.inputBuffer.getChannelData(0)
          const copy = new Float32Array(inputData.length)
          copy.set(inputData)
          recordingBufferRef.current.push(copy)
          samplesRecorded += inputData.length

          if (samplesRecorded >= samplesToRecord) {
            isRecordingRef.current = false
            processor.removeEventListener("audioprocess", handleAudioProcess as EventListener)

            const recordedLength = recordingBufferRef.current.reduce(
              (acc, arr) => acc + arr.length,
              0,
            )
            const preRollLength = preRollData?.length ?? 0
            const totalLength = preRollLength + recordedLength
            const audioData = new Float32Array(totalLength)

            let offset = 0
            if (preRollData) {
              audioData.set(preRollData, offset)
              offset += preRollLength
            }
            for (const chunk of recordingBufferRef.current) {
              audioData.set(chunk, offset)
              offset += chunk.length
            }

            resolve({
              index: 0,
              audioData,
              sampleRate,
            })
          }
        }

        processor.addEventListener("audioprocess", handleAudioProcess as EventListener)
      })
    },
    [recordDurationMs],
  )

  const runRecordingLoop = useCallback(
    async (sampleRate: number) => {
      const collectedSamples: RecordedSample[] = []
      const preRollSamplesNeeded = Math.ceil((preRollDurationMs / 1000) * sampleRate)

      for (let i = 0; i < samplesPerSession; i++) {
        if (stopRequestedRef.current) break

        setCurrentSampleIndex(i)
        setRecordingPhase("waiting-for-silence")

        // Wait for silence
        while (!stopRequestedRef.current) {
          const amplitude = getAmplitude()
          if (amplitude < silenceThreshold) break
          await new Promise((r) => setTimeout(r, 50))
        }
        if (stopRequestedRef.current) break

        setRecordingPhase("ready-to-pluck")

        // Start capturing pre-roll audio
        preRollBufferRef.current = []
        preRollSamplesNeededRef.current = preRollSamplesNeeded
        isCapturingPreRollRef.current = true

        const preRollHandler = (e: AudioProcessingEvent) => {
          if (!isCapturingPreRollRef.current) return

          const inputData = e.inputBuffer.getChannelData(0)
          const copy = new Float32Array(inputData.length)
          copy.set(inputData)
          preRollBufferRef.current.push(copy)

          // Keep only the most recent chunks needed for pre-roll
          let totalSamples = preRollBufferRef.current.reduce((acc, arr) => acc + arr.length, 0)
          while (
            totalSamples > preRollSamplesNeededRef.current &&
            preRollBufferRef.current.length > 1
          ) {
            const removed = preRollBufferRef.current.shift()
            if (removed) totalSamples -= removed.length
          }
        }

        const processor = processorRef.current
        processor?.addEventListener("audioprocess", preRollHandler as EventListener)

        // Wait for pluck
        while (!stopRequestedRef.current) {
          const amplitude = getAmplitude()
          if (amplitude > pluckThreshold) break
          await new Promise((r) => setTimeout(r, 10))
        }

        // Stop pre-roll capture and extract the buffer
        isCapturingPreRollRef.current = false
        processor?.removeEventListener("audioprocess", preRollHandler as EventListener)

        if (stopRequestedRef.current) break

        // Extract pre-roll data (last preRollSamplesNeeded samples)
        let preRollData: Float32Array | null = null
        if (preRollBufferRef.current.length > 0) {
          const totalPreRollLength = preRollBufferRef.current.reduce(
            (acc, arr) => acc + arr.length,
            0,
          )
          const combinedPreRoll = new Float32Array(totalPreRollLength)
          let offset = 0
          for (const chunk of preRollBufferRef.current) {
            combinedPreRoll.set(chunk, offset)
            offset += chunk.length
          }
          // Take only the last preRollSamplesNeeded samples
          const startIndex = Math.max(0, totalPreRollLength - preRollSamplesNeeded)
          preRollData = combinedPreRoll.slice(startIndex)
        }

        setRecordingPhase("recording")

        const sample = await recordSample(sampleRate, preRollData)
        if (sample && !stopRequestedRef.current) {
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
    [
      samplesPerSession,
      preRollDurationMs,
      getAmplitude,
      silenceThreshold,
      pluckThreshold,
      recordSample,
      cleanup,
    ],
  )

  const startSession = useCallback(async () => {
    try {
      setError(null)
      setSamples([])
      setCurrentSampleIndex(0)
      stopRequestedRef.current = false

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      source.connect(processor)
      processor.connect(audioContext.destination)

      setSessionState("recording")
      runRecordingLoop(audioContext.sampleRate)
    } catch (err) {
      console.error("Failed to start recording session:", err)
      setError(err instanceof Error ? err.message : "Failed to start recording")
      cleanup()
    }
  }, [runRecordingLoop, cleanup])

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

  const getSampleBlob = useCallback((sample: RecordedSample): Blob => {
    const numChannels = 1
    const bytesPerSample = 2
    const dataLength = sample.audioData.length * bytesPerSample
    const buffer = new ArrayBuffer(44 + dataLength)
    const view = new DataView(buffer)

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
    view.setUint32(24, sample.sampleRate, true)
    view.setUint32(28, sample.sampleRate * numChannels * bytesPerSample, true)
    view.setUint16(32, numChannels * bytesPerSample, true)
    view.setUint16(34, bytesPerSample * 8, true)
    writeString(36, "data")
    view.setUint32(40, dataLength, true)

    let offset = 44
    for (let i = 0; i < sample.audioData.length; i++) {
      const s = Math.max(-1, Math.min(1, sample.audioData[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }

    return new Blob([buffer], { type: "audio/wav" })
  }, [])

  return {
    sessionState,
    recordingPhase,
    currentSampleIndex,
    samples,
    error,
    startSession,
    stopSession,
    discardSession,
    getSampleBlob,
  }
}
