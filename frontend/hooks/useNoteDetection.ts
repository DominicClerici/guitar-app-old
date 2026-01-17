"use client"

import { PitchDetector } from "pitchy"
import { useCallback, useEffect, useRef, useState } from "react"

export type NoteDetectionStatus = "idle" | "requesting" | "recording" | "error"

export interface PitchData {
  pitch: number
  clarity: number
}

interface UseNoteDetectionOptions {
  bufferSize?: number
  minClarity?: number
  onPitchDetected?: (data: PitchData) => void
}

interface UseNoteDetectionResult {
  status: NoteDetectionStatus
  error: string | null
  sampleRate: number
  bufferDurationMs: number
  startListening: () => Promise<void>
  stopListening: () => void
}

const DEFAULT_BUFFER_SIZE = 2048
const DEFAULT_MIN_CLARITY = 0.9

export function useNoteDetection(options: UseNoteDetectionOptions = {}): UseNoteDetectionResult {
  const [status, setStatus] = useState<NoteDetectionStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [sampleRate, setSampleRate] = useState<number>(44100)
  const [bufferDurationMs, setBufferDurationMs] = useState<number>(
    (DEFAULT_BUFFER_SIZE / 44100) * 1000
  )

  const bufferSizeRef = useRef(options.bufferSize ?? DEFAULT_BUFFER_SIZE)
  const minClarityRef = useRef(options.minClarity ?? DEFAULT_MIN_CLARITY)
  const onPitchDetectedRef = useRef(options.onPitchDetected)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const detectorRef = useRef<PitchDetector<Float32Array> | null>(null)
  const inputArrayRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const lastUpdateRef = useRef<number>(0)

  useEffect(() => {
    bufferSizeRef.current = options.bufferSize ?? DEFAULT_BUFFER_SIZE
    minClarityRef.current = options.minClarity ?? DEFAULT_MIN_CLARITY
    onPitchDetectedRef.current = options.onPitchDetected
  }, [options.bufferSize, options.minClarity, options.onPitchDetected])

  const updatePitch = useCallback(() => {
    const analyser = analyserRef.current
    const detector = detectorRef.current
    const input = inputArrayRef.current
    const audioContext = audioContextRef.current

    if (!analyser || !detector || !input || !audioContext) return

    const now = Date.now()
    const currentBufferDurationMs = (bufferSizeRef.current / audioContext.sampleRate) * 1000

    if (now - lastUpdateRef.current >= currentBufferDurationMs) {
      lastUpdateRef.current = now

      analyser.getFloatTimeDomainData(input)
      const [detectedPitch, detectedClarity] = detector.findPitch(input, audioContext.sampleRate)

      const pitch =
        detectedClarity >= minClarityRef.current && detectedPitch > 0 ? detectedPitch : -1

      onPitchDetectedRef.current?.({ pitch, clarity: detectedClarity })
    }

    animationFrameRef.current = requestAnimationFrame(updatePitch)
  }, [])

  const startListening = useCallback(async () => {
    try {
      setStatus("requesting")
      setError(null)

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      setSampleRate(audioContext.sampleRate)

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = bufferSizeRef.current * 2
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize)
      inputArrayRef.current = new Float32Array(analyser.fftSize)

      setBufferDurationMs((bufferSizeRef.current / audioContext.sampleRate) * 1000)
      setStatus("recording")
      animationFrameRef.current = requestAnimationFrame(updatePitch)
    } catch (err) {
      console.error("Failed to start listening:", err)
      setError(err instanceof Error ? err.message : "Failed to start listening")
      setStatus("error")
    }
  }, [updatePitch])

  const stopListening = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
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
    detectorRef.current = null
    inputArrayRef.current = null

    setStatus("idle")
  }, [])

  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  return {
    status,
    error,
    sampleRate,
    bufferDurationMs,
    startListening,
    stopListening,
  }
}
