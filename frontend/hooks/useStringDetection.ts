"use client"

import { PitchDetector } from "pitchy"
import { useCallback, useEffect, useRef, useState } from "react"

import { getActiveCalibration, loadCalibrationData } from "@/lib/audio/calibration-storage"
import type { StringDetectionResult } from "@/lib/audio/guitar-constants"
import {
  calculateInharmonicityCoefficient,
  calculateSpectralFeatures,
  computeMagnitudeSpectrum,
  detectHarmonicPeaks,
  getNormalizedHarmonicAmplitudes,
} from "@/lib/audio/harmonic-analysis"
import {
  classifyString,
  getStringName,
  setActiveCalibrationProfile,
} from "@/lib/audio/string-classifier"

export type StringDetectionStatus = "idle" | "requesting" | "recording" | "error"

interface UseStringDetectionOptions {
  bufferSize?: number
  minClarity?: number
  updateIntervalMs?: number
  fftSize?: number
  calibrationId?: string
}

interface UseStringDetectionResult {
  status: StringDetectionStatus
  error: string | null
  pitch: number
  clarity: number
  sampleRate: number
  stringNumber: number | null
  stringName: string | null
  fretNumber: number | null
  stringConfidence: number
  startListening: () => Promise<void>
  stopListening: () => void
}

const DEFAULT_OPTIONS = {
  bufferSize: 2048,
  minClarity: 0.9,
  updateIntervalMs: 50,
  fftSize: 8192,
  calibrationId: undefined as string | undefined,
}

export function useStringDetection(
  options: UseStringDetectionOptions = {}
): UseStringDetectionResult {
  const [status, setStatus] = useState<StringDetectionStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [pitch, setPitch] = useState<number>(-1)
  const [clarity, setClarity] = useState<number>(0)
  const [sampleRate, setSampleRate] = useState<number>(44100)
  const [stringNumber, setStringNumber] = useState<number | null>(null)
  const [stringName, setStringName] = useState<string | null>(null)
  const [fretNumber, setFretNumber] = useState<number | null>(null)
  const [stringConfidence, setStringConfidence] = useState<number>(0)

  const optionsRef = useRef({ ...DEFAULT_OPTIONS, ...options })
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const detectorRef = useRef<PitchDetector<Float32Array> | null>(null)
  const inputArrayRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const onsetTimeRef = useRef<number | null>(null)
  const previousPitchRef = useRef<number>(-1)

  useEffect(() => {
    optionsRef.current = { ...DEFAULT_OPTIONS, ...options }
  }, [options])

  useEffect(() => {
    if (options.calibrationId) {
      const calibration = loadCalibrationData(options.calibrationId)
      setActiveCalibrationProfile(calibration)
    } else {
      const activeCalibration = getActiveCalibration()
      setActiveCalibrationProfile(activeCalibration)
    }
  }, [options.calibrationId])

  const updatePitchAndString = useCallback(() => {
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

      if (
        detectedClarity >= optionsRef.current.minClarity &&
        detectedPitch > 0
      ) {
        if (previousPitchRef.current <= 0) {
          onsetTimeRef.current = now
        }
        previousPitchRef.current = detectedPitch

        setPitch(detectedPitch)
        setClarity(detectedClarity)

        const { frequencies, magnitudes } = computeMagnitudeSpectrum(
          analyser,
          optionsRef.current.fftSize
        )

        const harmonicPeaks = detectHarmonicPeaks(
          frequencies,
          magnitudes,
          detectedPitch
        )

        const inharmonicity = calculateInharmonicityCoefficient(harmonicPeaks)
        const spectralFeatures = calculateSpectralFeatures(frequencies, magnitudes)
        const normalizedHarmonics = getNormalizedHarmonicAmplitudes(harmonicPeaks)

        const timeSinceOnset = onsetTimeRef.current
          ? now - onsetTimeRef.current
          : undefined

        const result = classifyString(
          detectedPitch,
          inharmonicity,
          spectralFeatures,
          normalizedHarmonics,
          timeSinceOnset
        )

        if (result) {
          setStringNumber(result.stringNumber)
          setStringName(getStringName(result.stringNumber))
          setFretNumber(result.fretNumber)
          setStringConfidence(result.confidence)
        } else {
          setStringNumber(null)
          setStringName(null)
          setFretNumber(null)
          setStringConfidence(0)
        }
      } else {
        previousPitchRef.current = -1
        onsetTimeRef.current = null
        setPitch(-1)
        setClarity(detectedClarity)
        setStringNumber(null)
        setStringName(null)
        setFretNumber(null)
        setStringConfidence(0)
      }
    }

    animationFrameRef.current = requestAnimationFrame(updatePitchAndString)
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
      analyser.fftSize = optionsRef.current.fftSize
      analyser.smoothingTimeConstant = 0.1
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize)
      inputArrayRef.current = new Float32Array(analyser.fftSize)

      setStatus("recording")
      animationFrameRef.current = requestAnimationFrame(updatePitchAndString)
    } catch (err) {
      console.error("Failed to start listening:", err)
      setError(err instanceof Error ? err.message : "Failed to start listening")
      setStatus("error")
    }
  }, [updatePitchAndString])

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
    onsetTimeRef.current = null
    previousPitchRef.current = -1

    setStatus("idle")
    setPitch(-1)
    setClarity(0)
    setStringNumber(null)
    setStringName(null)
    setFretNumber(null)
    setStringConfidence(0)
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
    stringNumber,
    stringName,
    fretNumber,
    stringConfidence,
    startListening,
    stopListening,
  }
}
