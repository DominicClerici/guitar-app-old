"use client"

import { PitchDetector } from "pitchy"
import { useCallback, useEffect, useRef, useState } from "react"

import type { AttackFeatures } from "@/lib/audio/attack-analysis"
import { analyzeAttackTransient } from "@/lib/audio/attack-analysis"
import { BayesianStringAccumulator } from "@/lib/audio/bayesian-accumulator"
import { getActiveCalibration, loadCalibrationData } from "@/lib/audio/calibration-storage"
import type { CandidateScoreInfo } from "@/lib/audio/guitar-constants"
import {
  calculateInharmonicityCoefficient,
  calculateSpectralFeatures,
  computeMagnitudeSpectrum,
  detectHarmonicPeaks,
  getNormalizedHarmonicAmplitudes,
} from "@/lib/audio/harmonic-analysis"
// import { StringScoreFilters } from "@/lib/audio/kalman-filter" disabled for now
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
  secondBestString: number | null
  secondBestConfidence: number
  scoreDifference: number
  allCandidateScores: CandidateScoreInfo[]
  measuredInharmonicity: number
  spectralCentroid: number
  expectedInharmonicity: number
  attackFeatures: AttackFeatures | null
  accumulatedProbabilities: number[]
  bayesianConfidence: number
  bayesianString: number | null
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
  options: UseStringDetectionOptions = {},
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
  const [secondBestString, setSecondBestString] = useState<number | null>(null)
  const [secondBestConfidence, setSecondBestConfidence] = useState<number>(0)
  const [scoreDifference, setScoreDifference] = useState<number>(0)
  const [allCandidateScores, setAllCandidateScores] = useState<CandidateScoreInfo[]>([])
  const [measuredInharmonicity, setMeasuredInharmonicity] = useState<number>(0)
  const [spectralCentroid, setSpectralCentroid] = useState<number>(0)
  const [expectedInharmonicity, setExpectedInharmonicity] = useState<number>(0)
  const [attackFeatures, setAttackFeatures] = useState<AttackFeatures | null>(null)
  const [accumulatedProbabilities, setAccumulatedProbabilities] = useState<number[]>([])
  const [bayesianConfidence, setBayesianConfidence] = useState<number>(0)
  const [bayesianString, setBayesianString] = useState<number | null>(null)

  const optionsRef = useRef({ ...DEFAULT_OPTIONS, ...options })
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const analyserLowRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const detectorRef = useRef<PitchDetector<Float32Array> | null>(null)
  const inputArrayRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const onsetTimeRef = useRef<number | null>(null)
  const previousPitchRef = useRef<number>(-1)
  const attackFeaturesRef = useRef<AttackFeatures | null>(null)
  const attackAnalyzedRef = useRef<boolean>(false)
  const bayesianAccumulatorRef = useRef<BayesianStringAccumulator>(
    new BayesianStringAccumulator(0.95),
  )
  // const scoreFiltersRef = useRef<StringScoreFilters>(
  //   new StringScoreFilters({ processNoise: 0.01, measurementNoise: 0.1 })
  // )

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
    const analyserLow = analyserLowRef.current
    const detector = detectorRef.current
    const input = inputArrayRef.current
    const audioContext = audioContextRef.current
    // const scoreFilters = scoreFiltersRef.current

    if (!analyser || !analyserLow || !detector || !input || !audioContext) return

    const now = Date.now()
    if (now - lastUpdateRef.current >= optionsRef.current.updateIntervalMs) {
      lastUpdateRef.current = now

      analyser.getFloatTimeDomainData(input)
      const [detectedPitch, detectedClarity] = detector.findPitch(input, audioContext.sampleRate)

      if (detectedClarity >= optionsRef.current.minClarity && detectedPitch > 0) {
        const isNewOnset = previousPitchRef.current <= 0
        if (isNewOnset) {
          onsetTimeRef.current = now
          attackFeaturesRef.current = null
          attackAnalyzedRef.current = false
          bayesianAccumulatorRef.current.reset()
          // scoreFilters.resetAll()
        }
        previousPitchRef.current = detectedPitch

        const timeSinceOnset = onsetTimeRef.current ? now - onsetTimeRef.current : undefined

        if (
          !attackAnalyzedRef.current &&
          timeSinceOnset !== undefined &&
          timeSinceOnset >= 20 &&
          timeSinceOnset < 100
        ) {
          const features = analyzeAttackTransient(input, audioContext.sampleRate, detectedPitch)
          attackFeaturesRef.current = features
          attackAnalyzedRef.current = true
          setAttackFeatures(features)
        }

        setPitch(detectedPitch)
        setClarity(detectedClarity)

        const useHighResolution = detectedPitch < 150
        const activeAnalyser = useHighResolution ? analyserLow : analyser
        const activeFftSize = useHighResolution ? 16384 : optionsRef.current.fftSize

        const { frequencies, magnitudes } = computeMagnitudeSpectrum(activeAnalyser, activeFftSize)

        const harmonicPeaks = detectHarmonicPeaks(frequencies, magnitudes, detectedPitch)

        const inharmonicity = calculateInharmonicityCoefficient(harmonicPeaks)
        const spectralFeatures = calculateSpectralFeatures(frequencies, magnitudes)
        const normalizedHarmonics = getNormalizedHarmonicAmplitudes(harmonicPeaks)

        const result = classifyString(
          detectedPitch,
          inharmonicity,
          spectralFeatures,
          normalizedHarmonics,
          timeSinceOnset,
          attackFeaturesRef.current ?? undefined,
        )

        if (result) {
          // const filteredScores = result.allCandidateScores.map((candidate) => {
          //   const filteredScore = scoreFilters.updateScore(
          //     candidate.stringNumber,
          //     candidate.fretNumber,
          //     candidate.totalScore
          //   )
          //   return {
          //     ...candidate,
          //     totalScore: filteredScore,
          //   }
          // })
          const filteredScores = result.allCandidateScores

          filteredScores.sort((a, b) => b.totalScore - a.totalScore)

          const best = filteredScores[0]
          const secondBest = filteredScores.length > 1 ? filteredScores[1] : null

          const filteredScoreDifference = secondBest ? best.totalScore - secondBest.totalScore : 1
          const filteredConfidence = Math.min(0.95, 0.5 + filteredScoreDifference * 2)

          const bayesianResult = bayesianAccumulatorRef.current.update(filteredScores)
          setAccumulatedProbabilities(bayesianResult.probabilities)
          setBayesianConfidence(bayesianResult.confidence)
          setBayesianString(bayesianResult.dominantString)

          setStringNumber(best.stringNumber)
          setStringName(getStringName(best.stringNumber))
          setFretNumber(best.fretNumber)
          setStringConfidence(filteredConfidence)
          setSecondBestString(secondBest?.stringNumber ?? null)
          setSecondBestConfidence(secondBest?.totalScore ?? 0)
          setScoreDifference(filteredScoreDifference)
          setAllCandidateScores(filteredScores)
          setMeasuredInharmonicity(result.measuredInharmonicity)
          setSpectralCentroid(result.spectralCentroid)
          setExpectedInharmonicity(result.expectedInharmonicity)
        } else {
          setStringNumber(null)
          setStringName(null)
          setFretNumber(null)
          setStringConfidence(0)
          setSecondBestString(null)
          setSecondBestConfidence(0)
          setScoreDifference(0)
          setAllCandidateScores([])
          setMeasuredInharmonicity(0)
          setSpectralCentroid(0)
          setExpectedInharmonicity(0)
          setAccumulatedProbabilities([])
          setBayesianConfidence(0)
          setBayesianString(null)
        }
      } else {
        previousPitchRef.current = -1
        onsetTimeRef.current = null
        attackFeaturesRef.current = null
        attackAnalyzedRef.current = false
        bayesianAccumulatorRef.current.reset()
        // scoreFilters.clear()
        setPitch(-1)
        setClarity(detectedClarity)
        setStringNumber(null)
        setStringName(null)
        setFretNumber(null)
        setStringConfidence(0)
        setSecondBestString(null)
        setSecondBestConfidence(0)
        setScoreDifference(0)
        setAllCandidateScores([])
        setMeasuredInharmonicity(0)
        setSpectralCentroid(0)
        setExpectedInharmonicity(0)
        setAttackFeatures(null)
        setAccumulatedProbabilities([])
        setBayesianConfidence(0)
        setBayesianString(null)
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

      const analyserLow = audioContext.createAnalyser()
      analyserLow.fftSize = 16384
      analyserLow.smoothingTimeConstant = 0.1
      analyserLowRef.current = analyserLow

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      source.connect(analyserLow)

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
    analyserLowRef.current = null
    detectorRef.current = null
    inputArrayRef.current = null
    onsetTimeRef.current = null
    previousPitchRef.current = -1
    bayesianAccumulatorRef.current.reset()
    // scoreFiltersRef.current.clear()

    setStatus("idle")
    setPitch(-1)
    setClarity(0)
    setStringNumber(null)
    setStringName(null)
    setFretNumber(null)
    setStringConfidence(0)
    setSecondBestString(null)
    setSecondBestConfidence(0)
    setScoreDifference(0)
    setAllCandidateScores([])
    setMeasuredInharmonicity(0)
    setSpectralCentroid(0)
    setExpectedInharmonicity(0)
    setAccumulatedProbabilities([])
    setBayesianConfidence(0)
    setBayesianString(null)
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
    secondBestString,
    secondBestConfidence,
    scoreDifference,
    allCandidateScores,
    measuredInharmonicity,
    spectralCentroid,
    expectedInharmonicity,
    attackFeatures,
    accumulatedProbabilities,
    bayesianConfidence,
    bayesianString,
    startListening,
    stopListening,
  }
}
