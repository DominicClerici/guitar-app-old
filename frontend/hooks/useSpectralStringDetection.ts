"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { PitchDetector } from "pitchy"
import {
  extractSpectralFeatures,
  featuresToVector,
  extractMultiWindowFeatures,
  type SpectralFeatures,
  type FeatureExtractionConfig,
} from "@/lib/audio/spectral-features"
import {
  KNNClassifier,
  type ClassificationResult,
  type KNNModelData,
} from "@/lib/audio/knn-classifier"
import {
  getCandidateStrings,
  getStringProfile,
  type StringCandidate,
} from "@/lib/audio/guitar-constants"

export type SpectralDetectionStatus = "idle" | "requesting" | "recording" | "training" | "error"

export interface SpectralStringDetectionResult {
  stringNumber: number
  fretNumber: number
  stringName: string
  confidence: number
  probabilities: Map<number, number>
}

export interface SpectralDetectionData {
  pitch: number
  clarity: number
  features: SpectralFeatures
  featureVector: number[]
  candidates: StringCandidate[]
  detection: SpectralStringDetectionResult | null
  classificationResult: ClassificationResult | null
}

export interface TrainingStats {
  totalSamples: number
  samplesPerString: Map<number, number>
  accuracy: number | null
  isTrained: boolean
}

interface UseSpectralStringDetectionOptions {
  fftSize?: number
  minClarity?: number
  k?: number
  autoLoadModel?: boolean
  onDataUpdate?: (data: SpectralDetectionData) => void
}

interface UseSpectralStringDetectionResult {
  status: SpectralDetectionStatus
  error: string | null
  sampleRate: number
  data: SpectralDetectionData | null
  trainingStats: TrainingStats
  startListening: () => Promise<void>
  stopListening: () => void
  addTrainingSample: (stringNumber: number, fret?: number) => void
  clearModel: () => void
  saveModel: () => void
  loadModel: () => boolean
  exportModel: () => KNNModelData | null
  importModel: (data: KNNModelData) => void
  setK: (k: number) => void
  crossValidate: () => { accuracy: number; confusionMatrix: Map<number, Map<number, number>> } | null
  optimizeK: () => { bestK: number; accuracies: Map<number, number> } | null
}

const DEFAULT_FFT_SIZE = 4096
const DEFAULT_MIN_CLARITY = 0.85
const DEFAULT_K = 5
const AUDIO_BUFFER_DURATION_MS = 400

export function useSpectralStringDetection(
  options: UseSpectralStringDetectionOptions = {}
): UseSpectralStringDetectionResult {
  const [status, setStatus] = useState<SpectralDetectionStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [sampleRate, setSampleRate] = useState<number>(44100)
  const [data, setData] = useState<SpectralDetectionData | null>(null)
  const [trainingStats, setTrainingStats] = useState<TrainingStats>({
    totalSamples: 0,
    samplesPerString: new Map(),
    accuracy: null,
    isTrained: false,
  })

  const fftSizeRef = useRef(options.fftSize ?? DEFAULT_FFT_SIZE)
  const minClarityRef = useRef(options.minClarity ?? DEFAULT_MIN_CLARITY)
  const onDataUpdateRef = useRef(options.onDataUpdate)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const detectorRef = useRef<PitchDetector<Float32Array<ArrayBuffer>> | null>(null)
  const timeDomainBufferRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const previousMagnitudesRef = useRef<Float32Array | null>(null)

  const classifierRef = useRef<KNNClassifier>(new KNNClassifier(options.k ?? DEFAULT_K))
  const lastFeaturesRef = useRef<number[] | null>(null)
  const lastPitchRef = useRef<number>(0)

  const audioBufferRef = useRef<Float32Array[]>([])
  const noteOnsetTimeRef = useRef<number | null>(null)
  const lastClarityRef = useRef<number>(0)

  useEffect(() => {
    fftSizeRef.current = options.fftSize ?? DEFAULT_FFT_SIZE
    minClarityRef.current = options.minClarity ?? DEFAULT_MIN_CLARITY
    onDataUpdateRef.current = options.onDataUpdate
  }, [options.fftSize, options.minClarity, options.onDataUpdate])

  useEffect(() => {
    if (options.autoLoadModel !== false) {
      const loaded = classifierRef.current.loadFromStorage()
      if (loaded) {
        updateTrainingStats()
      }
    }
  }, [])

  const updateTrainingStats = useCallback(() => {
    const classifier = classifierRef.current
    setTrainingStats({
      totalSamples: classifier.getSampleCount(),
      samplesPerString: classifier.getSampleCountByClass(),
      accuracy: null,
      isTrained: classifier.getSampleCount() > 0,
    })
  }, [])

  const classifyWithCandidateFiltering = useCallback(
    (
      features: number[],
      candidates: StringCandidate[]
    ): { result: ClassificationResult | null; detection: SpectralStringDetectionResult | null } => {
      const classifier = classifierRef.current
      if (classifier.getSampleCount() === 0) {
        return { result: null, detection: null }
      }

      const result = classifier.classify(features)
      if (!result) {
        return { result: null, detection: null }
      }

      const candidateStrings = new Set(candidates.map((c) => c.stringNumber))

      if (candidateStrings.size > 0 && !candidateStrings.has(result.predictedClass)) {
        let bestCandidate = result.predictedClass
        let bestProb = 0

        for (const [stringNum, prob] of result.probabilities) {
          if (candidateStrings.has(stringNum) && prob > bestProb) {
            bestProb = prob
            bestCandidate = stringNum
          }
        }

        if (bestProb > 0) {
          result.predictedClass = bestCandidate
          result.confidence = bestProb
        }
      }

      const matchingCandidate = candidates.find((c) => c.stringNumber === result.predictedClass)
      const fretNumber = matchingCandidate?.fretNumber ?? 0

      const profile = getStringProfile(result.predictedClass)
      const detection: SpectralStringDetectionResult = {
        stringNumber: result.predictedClass,
        fretNumber,
        stringName: profile?.name ?? `String ${result.predictedClass}`,
        confidence: result.confidence,
        probabilities: result.probabilities,
      }

      return { result, detection }
    },
    []
  )

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

      audioBufferRef.current.push(new Float32Array(timeDomainBuffer))
      const maxBufferChunks = Math.ceil(
        (AUDIO_BUFFER_DURATION_MS / 1000) * audioContext.sampleRate / fftSizeRef.current
      )
      while (audioBufferRef.current.length > maxBufferChunks) {
        audioBufferRef.current.shift()
      }

      const [detectedPitch, detectedClarity] = detector.findPitch(
        timeDomainBuffer,
        audioContext.sampleRate
      )

      const isNewNote =
        detectedClarity >= minClarityRef.current &&
        lastClarityRef.current < minClarityRef.current &&
        detectedPitch > 60 &&
        detectedPitch < 1500
      lastClarityRef.current = detectedClarity

      if (isNewNote) {
        noteOnsetTimeRef.current = now
      }

      if (
        detectedClarity >= minClarityRef.current &&
        detectedPitch > 60 &&
        detectedPitch < 1500
      ) {
        const featureConfig: Partial<FeatureExtractionConfig> = {
          sampleRate: audioContext.sampleRate,
          fftSize: fftSizeRef.current,
        }

        const features = extractSpectralFeatures(
          timeDomainBuffer,
          detectedPitch,
          featureConfig,
          previousMagnitudesRef.current
        )

        const singleWindowFeatureVector = featuresToVector(features)
        lastPitchRef.current = detectedPitch

        const candidates = getCandidateStrings(detectedPitch)

        let classificationFeatureVector: number[]
        const timeSinceOnset = noteOnsetTimeRef.current ? now - noteOnsetTimeRef.current : 0
        const hasEnoughHistory = timeSinceOnset >= 300 && audioBufferRef.current.length >= 2

        if (hasEnoughHistory) {
          const totalLength = audioBufferRef.current.reduce((acc, chunk) => acc + chunk.length, 0)
          const combinedBuffer = new Float32Array(totalLength)
          let offset = 0
          for (const chunk of audioBufferRef.current) {
            combinedBuffer.set(chunk, offset)
            offset += chunk.length
          }

          const onsetSampleOffset = Math.floor(
            ((totalLength / audioContext.sampleRate) * 1000 - timeSinceOnset) / 1000 * audioContext.sampleRate
          )
          const relevantStart = Math.max(0, onsetSampleOffset)
          const relevantBuffer = combinedBuffer.slice(relevantStart)

          if (relevantBuffer.length >= fftSizeRef.current) {
            classificationFeatureVector = extractMultiWindowFeatures(
              relevantBuffer,
              detectedPitch,
              audioContext.sampleRate,
              fftSizeRef.current
            )
          } else {
            classificationFeatureVector = [
              ...singleWindowFeatureVector,
              ...singleWindowFeatureVector,
              ...singleWindowFeatureVector,
              features.inharmonicity,
            ]
          }
        } else {
          classificationFeatureVector = [
            ...singleWindowFeatureVector,
            ...singleWindowFeatureVector,
            ...singleWindowFeatureVector,
            features.inharmonicity,
          ]
        }

        lastFeaturesRef.current = classificationFeatureVector

        const { result, detection } = classifyWithCandidateFiltering(classificationFeatureVector, candidates)

        const newData: SpectralDetectionData = {
          pitch: detectedPitch,
          clarity: detectedClarity,
          features,
          featureVector: classificationFeatureVector,
          candidates,
          detection,
          classificationResult: result,
        }

        setData(newData)
        onDataUpdateRef.current?.(newData)
      } else {
        setData(null)
        lastFeaturesRef.current = null
        noteOnsetTimeRef.current = null
      }
    }

    animationFrameRef.current = requestAnimationFrame(processAudio)
  }, [classifyWithCandidateFiltering])

  const startListening = useCallback(async () => {
    try {
      setStatus("requesting")
      setError(null)

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
    previousMagnitudesRef.current = null
    audioBufferRef.current = []
    noteOnsetTimeRef.current = null
    lastClarityRef.current = 0

    setStatus("idle")
    setData(null)
  }, [])

  const addTrainingSample = useCallback(
    (stringNumber: number, fret?: number) => {
      if (!lastFeaturesRef.current) {
        setError("No audio features available. Play a note first.")
        return
      }

      try {
        classifierRef.current.addSample(lastFeaturesRef.current, stringNumber, { fret })
        updateTrainingStats()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add training sample")
      }
    },
    [updateTrainingStats]
  )

  const optimizeK = useCallback((): { bestK: number; accuracies: Map<number, number> } | null => {
    if (classifierRef.current.getSampleCount() < 3) {
      setError("Need at least 3 samples to optimize K")
      return null
    }

    try {
      const result = classifierRef.current.optimizeK(15)
      classifierRef.current.setK(result.bestK)
      classifierRef.current.saveToStorage()
      setTrainingStats((prev) => ({ ...prev, accuracy: result.accuracies.get(result.bestK) ?? null }))
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to optimize K")
      return null
    }
  }, [])

  const clearModel = useCallback(() => {
    classifierRef.current.clearSamples()
    KNNClassifier.clearStorage()
    updateTrainingStats()
  }, [updateTrainingStats])

  const saveModel = useCallback(() => {
    classifierRef.current.saveToStorage()
  }, [])

  const loadModel = useCallback((): boolean => {
    const success = classifierRef.current.loadFromStorage()
    if (success) {
      updateTrainingStats()
    }
    return success
  }, [updateTrainingStats])

  const exportModel = useCallback((): KNNModelData | null => {
    if (classifierRef.current.getSampleCount() === 0) {
      return null
    }
    return classifierRef.current.exportModel()
  }, [])

  const importModel = useCallback(
    (modelData: KNNModelData) => {
      classifierRef.current.importModel(modelData)
      updateTrainingStats()
    },
    [updateTrainingStats]
  )

  const setK = useCallback((k: number) => {
    classifierRef.current.setK(k)
  }, [])

  const crossValidate = useCallback((): {
    accuracy: number
    confusionMatrix: Map<number, Map<number, number>>
  } | null => {
    if (classifierRef.current.getSampleCount() < 10) {
      setError("Need at least 10 samples for cross-validation")
      return null
    }

    try {
      const result = classifierRef.current.crossValidate(5)
      setTrainingStats((prev) => ({ ...prev, accuracy: result.accuracy }))
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cross-validation failed")
      return null
    }
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
    trainingStats,
    startListening,
    stopListening,
    addTrainingSample,
    clearModel,
    saveModel,
    loadModel,
    exportModel,
    importModel,
    setK,
    crossValidate,
    optimizeK,
  }
}
