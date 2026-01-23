"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  extractFeaturesWithSpectrum,
  featuresToVector,
  type SpectralFeatures,
  type AudioBuffer,
} from "@/lib/audio/spectral-features"
import {
  KNNClassifier,
  type KNNModel,
  type PredictionResult,
  type TrainingSample,
} from "@/lib/audio/knn-classifier"
import { getCandidateStrings, STRINGS } from "@/lib/audio/guitar-constants"

export type StringDetectionStatus = "idle" | "requesting" | "listening" | "error"
export type DetectionMethod = "knn" | "rule-based"

export interface StringDetectionResult {
  predictedString: number | null
  confidence: number
  allConfidences: Record<number, number>
  candidateStrings: number[]
  method: DetectionMethod
}

export interface SpectralAnalysis {
  features: SpectralFeatures | null
  featureVector: number[]
}

interface UseSpectralStringDetectionOptions {
  bufferSize?: number
  detectionMethod?: DetectionMethod
  fundamentalFrequency?: number
  onDetection?: (result: StringDetectionResult) => void
  onFeaturesExtracted?: (analysis: SpectralAnalysis) => void
  knnModel?: KNNModel
}

interface UseSpectralStringDetectionResult {
  status: StringDetectionStatus
  error: string | null
  sampleRate: number
  currentResult: StringDetectionResult | null
  currentFeatures: SpectralFeatures | null
  detectionMethod: DetectionMethod
  setDetectionMethod: (method: DetectionMethod) => void
  setFundamentalFrequency: (freq: number | undefined) => void
  startListening: () => Promise<void>
  stopListening: () => void
  classifier: {
    train: (samples: TrainingSample[]) => void
    addSample: (sample: TrainingSample) => void
    removeSamplesForString: (stringNumber: number) => void
    exportModel: () => KNNModel
    importModel: (model: KNNModel) => void
    sampleCount: number
    samplesPerString: Record<number, number>
  }
  captureTrainingSample: (stringNumber: number) => TrainingSample | null
}

const DEFAULT_BUFFER_SIZE = 4096

export function useSpectralStringDetection(
  options: UseSpectralStringDetectionOptions = {}
): UseSpectralStringDetectionResult {
  const [status, setStatus] = useState<StringDetectionStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [sampleRate, setSampleRate] = useState<number>(44100)
  const [currentResult, setCurrentResult] = useState<StringDetectionResult | null>(null)
  const [currentFeatures, setCurrentFeatures] = useState<SpectralFeatures | null>(null)
  const [detectionMethod, setDetectionMethodState] = useState<DetectionMethod>(
    options.detectionMethod ?? "rule-based"
  )

  const bufferSizeRef = useRef(options.bufferSize ?? DEFAULT_BUFFER_SIZE)
  const fundamentalFreqRef = useRef(options.fundamentalFrequency)
  const onDetectionRef = useRef(options.onDetection)
  const onFeaturesExtractedRef = useRef(options.onFeaturesExtracted)
  const detectionMethodRef = useRef(detectionMethod)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const inputArrayRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const previousSpectrumRef = useRef<AudioBuffer | undefined>(undefined)

  const classifierRef = useRef<KNNClassifier>(new KNNClassifier(5))

  useEffect(() => {
    if (options.knnModel) {
      classifierRef.current.importModel(options.knnModel)
    }
  }, [options.knnModel])

  useEffect(() => {
    bufferSizeRef.current = options.bufferSize ?? DEFAULT_BUFFER_SIZE
    fundamentalFreqRef.current = options.fundamentalFrequency
    onDetectionRef.current = options.onDetection
    onFeaturesExtractedRef.current = options.onFeaturesExtracted
  }, [
    options.bufferSize,
    options.fundamentalFrequency,
    options.onDetection,
    options.onFeaturesExtracted,
  ])

  const setDetectionMethod = useCallback((method: DetectionMethod) => {
    detectionMethodRef.current = method
    setDetectionMethodState(method)
  }, [])

  const setFundamentalFrequency = useCallback((freq: number | undefined) => {
    fundamentalFreqRef.current = freq
  }, [])

  const ruleBasedDetection = useCallback(
    (features: SpectralFeatures, freq: number | undefined): StringDetectionResult => {
      const candidates = freq ? getCandidateStrings(freq) : [1, 2, 3, 4, 5, 6]

      if (candidates.length === 0) {
        return {
          predictedString: null,
          confidence: 0,
          allConfidences: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
          candidateStrings: [],
          method: "rule-based",
        }
      }

      if (candidates.length === 1) {
        return {
          predictedString: candidates[0],
          confidence: 1,
          allConfidences: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, [candidates[0]]: 1 },
          candidateStrings: candidates,
          method: "rule-based",
        }
      }

      const scores: Record<number, number> = {}
      const { centroid, flatness, harmonicRatios } = features

      for (const stringNum of candidates) {
        const stringInfo = STRINGS.find((s) => s.number === stringNum)
        if (!stringInfo) continue

        let score = 0

        if (stringInfo.material === "wound") {
          score += (1 - flatness) * 0.3
          score += harmonicRatios.evenOdd * 0.2
        } else {
          score += flatness * 0.2
          score += (centroid > 1000 ? 0.3 : 0.1)
        }

        score += (7 - stringNum) * 0.05

        scores[stringNum] = Math.max(0, score)
      }

      const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
      const allConfidences: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }

      let maxScore = 0
      let predictedString = candidates[0]

      for (const stringNum of candidates) {
        const conf = totalScore > 0 ? scores[stringNum] / totalScore : 0
        allConfidences[stringNum] = conf
        if (scores[stringNum] > maxScore) {
          maxScore = scores[stringNum]
          predictedString = stringNum
        }
      }

      return {
        predictedString,
        confidence: allConfidences[predictedString],
        allConfidences,
        candidateStrings: candidates,
        method: "rule-based",
      }
    },
    []
  )

  const knnDetection = useCallback(
    (featureVector: number[], freq: number | undefined): StringDetectionResult => {
      const candidates = freq ? getCandidateStrings(freq) : [1, 2, 3, 4, 5, 6]

      if (classifierRef.current.sampleCount === 0) {
        return {
          predictedString: null,
          confidence: 0,
          allConfidences: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
          candidateStrings: candidates,
          method: "knn",
        }
      }

      let prediction: PredictionResult
      try {
        prediction = classifierRef.current.predict(featureVector)
      } catch {
        return {
          predictedString: null,
          confidence: 0,
          allConfidences: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
          candidateStrings: candidates,
          method: "knn",
        }
      }

      if (candidates.length > 0 && !candidates.includes(prediction.predictedString)) {
        let bestCandidate = candidates[0]
        let bestConf = prediction.allConfidences[candidates[0]] ?? 0
        for (const c of candidates) {
          const conf = prediction.allConfidences[c] ?? 0
          if (conf > bestConf) {
            bestConf = conf
            bestCandidate = c
          }
        }
        return {
          predictedString: bestCandidate,
          confidence: bestConf,
          allConfidences: prediction.allConfidences,
          candidateStrings: candidates,
          method: "knn",
        }
      }

      return {
        predictedString: prediction.predictedString,
        confidence: prediction.confidence,
        allConfidences: prediction.allConfidences,
        candidateStrings: candidates,
        method: "knn",
      }
    },
    []
  )

  const processAudio = useCallback(() => {
    const analyser = analyserRef.current
    const input = inputArrayRef.current
    const audioContext = audioContextRef.current

    if (!analyser || !input || !audioContext) return

    analyser.getFloatTimeDomainData(input)

    const { features, magnitudeSpectrum } = extractFeaturesWithSpectrum(
      input,
      audioContext.sampleRate,
      fundamentalFreqRef.current,
      previousSpectrumRef.current
    )

    previousSpectrumRef.current = magnitudeSpectrum

    setCurrentFeatures(features)

    const featureVector = featuresToVector(features)

    onFeaturesExtractedRef.current?.({ features, featureVector })

    let result: StringDetectionResult
    if (detectionMethodRef.current === "knn") {
      result = knnDetection(featureVector, fundamentalFreqRef.current)
    } else {
      result = ruleBasedDetection(features, fundamentalFreqRef.current)
    }

    setCurrentResult(result)
    onDetectionRef.current?.(result)

    animationFrameRef.current = requestAnimationFrame(processAudio)
  }, [knnDetection, ruleBasedDetection])

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

      inputArrayRef.current = new Float32Array(analyser.fftSize)
      previousSpectrumRef.current = undefined

      setStatus("listening")
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
    inputArrayRef.current = null
    previousSpectrumRef.current = undefined

    setStatus("idle")
    setCurrentResult(null)
    setCurrentFeatures(null)
  }, [])

  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  const captureTrainingSample = useCallback(
    (stringNumber: number): TrainingSample | null => {
      const features = currentFeatures
      if (!features) return null

      const featureVector = featuresToVector(features)
      return { stringNumber, features: featureVector }
    },
    [currentFeatures]
  )

  const classifier = {
    train: (samples: TrainingSample[]) => classifierRef.current.train(samples),
    addSample: (sample: TrainingSample) => classifierRef.current.addSample(sample),
    removeSamplesForString: (stringNumber: number) =>
      classifierRef.current.removeSamplesForString(stringNumber),
    exportModel: () => classifierRef.current.exportModel(),
    importModel: (model: KNNModel) => classifierRef.current.importModel(model),
    get sampleCount() {
      return classifierRef.current.sampleCount
    },
    get samplesPerString() {
      return classifierRef.current.samplesPerString
    },
  }

  return {
    status,
    error,
    sampleRate,
    currentResult,
    currentFeatures,
    detectionMethod,
    setDetectionMethod,
    setFundamentalFrequency,
    startListening,
    stopListening,
    classifier,
    captureTrainingSample,
  }
}
