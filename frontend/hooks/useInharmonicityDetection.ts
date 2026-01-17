"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { PitchDetector } from "pitchy"
import {
  analyzeInharmonicity,
  type DetectedPartial,
  type FFTAnalysisResult,
} from "@/lib/audio/fft-utils"
import {
  STANDARD_TUNING_STRINGS,
  getCandidateStrings,
  getStringProfile,
  type StringCandidate,
  type StringProfile,
} from "@/lib/audio/guitar-constants"

export type StringDetectionStatus = "idle" | "requesting" | "recording" | "error"

export interface StringDetectionResult {
  stringNumber: number
  fretNumber: number
  stringName: string
  confidence: number
}

export interface InharmonicityData {
  pitch: number
  clarity: number
  estimatedB: number
  bConfidence: number
  spectralCentroid: number
  partials: DetectedPartial[]
  candidates: StringCandidate[]
  detection: StringDetectionResult | null
}

interface UseInharmonicityDetectionOptions {
  fftSize?: number
  minClarity?: number
  maxHarmonics?: number
  onDataUpdate?: (data: InharmonicityData) => void
}

interface UseInharmonicityDetectionResult {
  status: StringDetectionStatus
  error: string | null
  sampleRate: number
  data: InharmonicityData | null
  startListening: () => Promise<void>
  stopListening: () => void
}

const DEFAULT_FFT_SIZE = 8192
const DEFAULT_MIN_CLARITY = 0.85
const DEFAULT_MAX_HARMONICS = 10

function calculateExpectedInharmonicity(
  stringProfile: StringProfile,
  fretNumber: number
): number {
  const openB = stringProfile.typicalInharmonicity
  const fretMultiplier = Math.pow(1.08, fretNumber)
  return openB * fretMultiplier
}

function classifyString(
  pitch: number,
  estimatedB: number,
  bConfidence: number,
  spectralCentroid: number,
  candidates: StringCandidate[]
): StringDetectionResult | null {
  if (candidates.length === 0) return null

  if (candidates.length === 1) {
    const c = candidates[0]
    const profile = getStringProfile(c.stringNumber)
    return {
      stringNumber: c.stringNumber,
      fretNumber: c.fretNumber,
      stringName: profile?.name ?? `String ${c.stringNumber}`,
      confidence: 0.9,
    }
  }

  const scored = candidates.map((candidate) => {
    const profile = getStringProfile(candidate.stringNumber)
    if (!profile) return { candidate, score: 0 }

    const expectedB = calculateExpectedInharmonicity(profile, candidate.fretNumber)
    const bRatio = estimatedB > 0 && expectedB > 0
      ? Math.min(estimatedB, expectedB) / Math.max(estimatedB, expectedB)
      : 0.5
    const inharmonicityScore = bRatio * bConfidence

    const expectedCentroid =
      profile.typicalCentroidRange.min +
      candidate.fretNumber * profile.centroidFretCoefficient
    const centroidDiff = Math.abs(spectralCentroid - expectedCentroid)
    const centroidRange = profile.typicalCentroidRange.max - profile.typicalCentroidRange.min
    const centroidScore = Math.max(0, 1 - centroidDiff / (centroidRange * 2))

    const fretPenalty = candidate.fretNumber > 12 ? 0.9 : 1.0

    const totalScore =
      (inharmonicityScore * 0.5 + centroidScore * 0.5) * fretPenalty

    return { candidate, score: totalScore }
  })

  scored.sort((a, b) => b.score - a.score)

  const best = scored[0]
  const profile = getStringProfile(best.candidate.stringNumber)

  const secondBestScore = scored.length > 1 ? scored[1].score : 0
  const scoreDiff = best.score - secondBestScore
  const confidence = Math.min(0.95, 0.5 + scoreDiff * 2)

  return {
    stringNumber: best.candidate.stringNumber,
    fretNumber: best.candidate.fretNumber,
    stringName: profile?.name ?? `String ${best.candidate.stringNumber}`,
    confidence,
  }
}

export function useInharmonicityDetection(
  options: UseInharmonicityDetectionOptions = {}
): UseInharmonicityDetectionResult {
  const [status, setStatus] = useState<StringDetectionStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [sampleRate, setSampleRate] = useState<number>(44100)
  const [data, setData] = useState<InharmonicityData | null>(null)

  const fftSizeRef = useRef(options.fftSize ?? DEFAULT_FFT_SIZE)
  const minClarityRef = useRef(options.minClarity ?? DEFAULT_MIN_CLARITY)
  const maxHarmonicsRef = useRef(options.maxHarmonics ?? DEFAULT_MAX_HARMONICS)
  const onDataUpdateRef = useRef(options.onDataUpdate)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const detectorRef = useRef<PitchDetector<Float32Array<ArrayBuffer>> | null>(null)
  const timeDomainBufferRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const lastUpdateRef = useRef<number>(0)

  useEffect(() => {
    fftSizeRef.current = options.fftSize ?? DEFAULT_FFT_SIZE
    minClarityRef.current = options.minClarity ?? DEFAULT_MIN_CLARITY
    maxHarmonicsRef.current = options.maxHarmonics ?? DEFAULT_MAX_HARMONICS
    onDataUpdateRef.current = options.onDataUpdate
  }, [options.fftSize, options.minClarity, options.maxHarmonics, options.onDataUpdate])

  const processAudio = useCallback(() => {
    const analyser = analyserRef.current
    const detector = detectorRef.current
    const timeDomainBuffer = timeDomainBufferRef.current
    const audioContext = audioContextRef.current

    if (!analyser || !detector || !timeDomainBuffer || !audioContext) return

    const now = Date.now()
    const updateInterval = 50

    if (now - lastUpdateRef.current >= updateInterval) {
      lastUpdateRef.current = now

      analyser.getFloatTimeDomainData(timeDomainBuffer)

      const [detectedPitch, detectedClarity] = detector.findPitch(
        timeDomainBuffer,
        audioContext.sampleRate
      )

      if (detectedClarity >= minClarityRef.current && detectedPitch > 60 && detectedPitch < 1500) {
        const fftResult = analyzeInharmonicity(
          timeDomainBuffer,
          detectedPitch,
          audioContext.sampleRate,
          maxHarmonicsRef.current
        )

        const candidates = getCandidateStrings(detectedPitch)

        const detection = classifyString(
          detectedPitch,
          fftResult.estimatedB,
          fftResult.confidence,
          fftResult.spectralCentroid,
          candidates
        )

        const newData: InharmonicityData = {
          pitch: detectedPitch,
          clarity: detectedClarity,
          estimatedB: fftResult.estimatedB,
          bConfidence: fftResult.confidence,
          spectralCentroid: fftResult.spectralCentroid,
          partials: fftResult.partials,
          candidates,
          detection,
        }

        setData(newData)
        onDataUpdateRef.current?.(newData)
      } else {
        setData(null)
      }
    }

    animationFrameRef.current = requestAnimationFrame(processAudio)
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
      analyser.fftSize = fftSizeRef.current
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize)
      timeDomainBufferRef.current = new Float32Array(analyser.fftSize)

      setStatus("recording")
      animationFrameRef.current = requestAnimationFrame(processAudio)
    } catch (err) {
      console.error("Failed to start listening:", err)
      setError(err instanceof Error ? err.message : "Failed to start listening")
      setStatus("error")
    }
  }, [processAudio])

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
    timeDomainBufferRef.current = null

    setStatus("idle")
    setData(null)
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
    data,
    startListening,
    stopListening,
  }
}
