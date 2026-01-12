"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { PitchDetector } from "pitchy"

export type NoteDetectionStatus = "idle" | "requesting" | "recording" | "error"

interface UseNoteDetectionOptions {
  bufferSize?: number
  minClarity?: number
  updateIntervalMs?: number
}

interface UseNoteDetectionResult {
  status: NoteDetectionStatus
  error: string | null
  pitch: number
  clarity: number
  sampleRate: number
  startListening: () => Promise<void>
  stopListening: () => void
}

const DEFAULT_OPTIONS: Required<UseNoteDetectionOptions> = {
  bufferSize: 2048,
  minClarity: 0.9,
  updateIntervalMs: 50,
}

export function useNoteDetection(
  options: UseNoteDetectionOptions = {}
): UseNoteDetectionResult {
  const [status, setStatus] = useState<NoteDetectionStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [pitch, setPitch] = useState<number>(-1)
  const [clarity, setClarity] = useState<number>(0)
  const [sampleRate, setSampleRate] = useState<number>(44100)

  const optionsRef = useRef({ ...DEFAULT_OPTIONS, ...options })
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const detectorRef = useRef<PitchDetector<Float32Array> | null>(null)
  const inputArrayRef = useRef<Float32Array | null>(null)
  const lastUpdateRef = useRef<number>(0)

  useEffect(() => {
    optionsRef.current = { ...DEFAULT_OPTIONS, ...options }
  }, [options])

  const updatePitch = useCallback(() => {
    const analyser = analyserRef.current
    const detector = detectorRef.current
    const input = inputArrayRef.current
    const audioContext = audioContextRef.current

    if (!analyser || !detector || !input || !audioContext) return

    const now = Date.now()
    if (now - lastUpdateRef.current >= optionsRef.current.updateIntervalMs) {
      lastUpdateRef.current = now

      analyser.getFloatTimeDomainData(input)
      const [detectedPitch, detectedClarity] = detector.findPitch(
        input,
        audioContext.sampleRate
      )

      if (detectedClarity >= optionsRef.current.minClarity && detectedPitch > 0) {
        setPitch(detectedPitch)
        setClarity(detectedClarity)
      } else {
        setPitch(-1)
        setClarity(detectedClarity)
      }
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
      analyser.fftSize = optionsRef.current.bufferSize * 2
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize)
      inputArrayRef.current = new Float32Array(analyser.fftSize)

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
    setPitch(-1)
    setClarity(0)
  }, [])

  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  return {
    status,
    error,
    pitch,
    clarity,
    sampleRate,
    startListening,
    stopListening,
  }
}
