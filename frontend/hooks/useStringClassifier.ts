"use client"

import {
  extractAllFeatures,
  featuresToVector,
  normalizeFeatures,
  type AudioFeatures,
} from "@/lib/audio/feature-extraction"
import * as ort from "onnxruntime-web"
import { useCallback, useEffect, useRef, useState } from "react"

// Match Python training exactly: 4096 samples (~93ms at 44.1kHz)
export const WINDOW_SIZE = 4096
// 50% overlap like Python's extract_windows() with hop_size = window_size // 2
const HOP_SIZE = WINDOW_SIZE / 2
// Minimum RMS energy to process a window (filters silence)
const MIN_RMS_THRESHOLD = 0.0015
// ScriptProcessor buffer size
const PROCESSOR_BUFFER_SIZE = 2048
// Target RMS for normalization (matches training data mean)
const TARGET_RMS = 0.026

// Production mode constants
const FREQUENCY_CHANGE_THRESHOLD = 0.03 // 3% change triggers new window
const ACCUMULATION_WINDOW_MS = 800 // Time to accumulate predictions before locking
const STRING_FREQUENCIES = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63] // E2, A2, D3, G3, B3, E4
const CONSECUTIVE_STRING_THRESHOLD = 3 // Number of consecutive same-string predictions required (1 = no check)

function calculateRMS(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i]
  }
  return Math.sqrt(sum / samples.length)
}

function normalizeAudioAmplitude(samples: Float32Array, targetRMS: number): Float32Array {
  const currentRMS = calculateRMS(samples)
  if (currentRMS < 1e-10) return samples

  const gain = targetRMS / currentRMS
  const normalized = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    normalized[i] = samples[i] * gain
  }
  return normalized
}

export type ClassifierStatus = "idle" | "loading" | "ready" | "recording" | "error"

export interface ScalerConfig {
  mean: number[]
  scale: number[]
  feature_names: string[]
  string_labels: string[]
}

export interface PredictionResult {
  stringIndex: number
  stringLabel: string
  confidence: number
  allProbabilities: number[]
  features: AudioFeatures
  debug?: {
    rawFeatureVector: number[]
    normalizedFeatureVector: number[]
    sampleRate: number
    sampleCount: number
    audioSamples: Float32Array
  }
}

export interface StablePrediction {
  stringIndex: number
  stringLabel: string
  fret: number
  confidence: number
  fundamental: number
  isLocked: boolean
}

interface AccumulatedPrediction {
  stringIndex: number
  fret: number
  totalWeight: number
  count: number
}

interface UseStringClassifierOptions {
  modelPath?: string
  scalerPath?: string
  minConfidence?: number
  onPrediction?: (result: PredictionResult) => void
  debug?: boolean
  productionMode?: boolean
}

interface UseStringClassifierResult {
  status: ClassifierStatus
  error: string | null
  prediction: PredictionResult | null
  stablePrediction: StablePrediction | null
  startListening: () => Promise<void>
  stopListening: () => void
  loadModel: () => Promise<void>
  isModelLoaded: boolean
  captureAudioSample: () => { samples: Float32Array; sampleRate: number } | null
  scaler: ScalerConfig | null
}

const DEFAULT_MODEL_PATH = "/models/string_classifier.onnx"
const DEFAULT_SCALER_PATH = "/models/scaler.json"
const DEFAULT_MIN_CONFIDENCE = 0.3
const STRING_LABELS = ["E2", "A2", "D3", "G3", "B3", "E4"]

export function useStringClassifier(
  options: UseStringClassifierOptions = {},
): UseStringClassifierResult {
  const [status, setStatus] = useState<ClassifierStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [stablePrediction, setStablePrediction] = useState<StablePrediction | null>(null)

  const modelPathRef = useRef(options.modelPath ?? DEFAULT_MODEL_PATH)
  const scalerPathRef = useRef(options.scalerPath ?? DEFAULT_SCALER_PATH)
  const minConfidenceRef = useRef(options.minConfidence ?? DEFAULT_MIN_CONFIDENCE)
  const onPredictionRef = useRef(options.onPrediction)
  const debugRef = useRef(options.debug ?? false)
  const productionModeRef = useRef(options.productionMode ?? false)

  // Production mode state refs
  const lastFundamentalRef = useRef<number | null>(null)
  const windowStartTimeRef = useRef<number | null>(null)
  const accumulatorRef = useRef<Map<string, AccumulatedPrediction>>(new Map())
  const lockedPredictionRef = useRef<StablePrediction | null>(null)
  const consecutiveStringCountRef = useRef(0)
  const lastPredictedStringRef = useRef<number | null>(null)
  const stringConfirmedRef = useRef(false)

  const sessionRef = useRef<ort.InferenceSession | null>(null)
  const scalerRef = useRef<ScalerConfig | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const isInferenceRunningRef = useRef(false)
  const isReleasedRef = useRef(false)

  // Rolling buffer to accumulate audio samples
  // We keep enough samples for at least one full window
  const audioBufferRef = useRef<Float32Array | null>(null)
  const bufferWriteIndexRef = useRef(0)
  // Track how many samples since last window extraction
  const samplesSinceLastWindowRef = useRef(0)

  useEffect(() => {
    modelPathRef.current = options.modelPath ?? DEFAULT_MODEL_PATH
    scalerPathRef.current = options.scalerPath ?? DEFAULT_SCALER_PATH
    minConfidenceRef.current = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE
    onPredictionRef.current = options.onPrediction
    debugRef.current = options.debug ?? false
    productionModeRef.current = options.productionMode ?? false
  }, [
    options.modelPath,
    options.scalerPath,
    options.minConfidence,
    options.onPrediction,
    options.debug,
    options.productionMode,
  ])

  const calculateFret = useCallback((fundamental: number, stringIndex: number): number => {
    const baseFreq = STRING_FREQUENCIES[stringIndex]
    const semitones = 12 * Math.log2(fundamental / baseFreq)
    const fret = Math.round(semitones)
    return Math.max(0, Math.min(24, fret))
  }, [])

  const resetProductionModeState = useCallback(() => {
    lastFundamentalRef.current = null
    windowStartTimeRef.current = null
    accumulatorRef.current.clear()
    lockedPredictionRef.current = null
    consecutiveStringCountRef.current = 0
    lastPredictedStringRef.current = null
    stringConfirmedRef.current = false
    setStablePrediction(null)
  }, [])

  const processProductionModePrediction = useCallback(
    (result: PredictionResult) => {
      const now = Date.now()
      const fundamental = result.features.fundamental
      const lastFundamental = lastFundamentalRef.current

      const frequencyChanged =
        lastFundamental !== null &&
        Math.abs(fundamental - lastFundamental) / lastFundamental > FREQUENCY_CHANGE_THRESHOLD

      if (frequencyChanged || lastFundamental === null) {
        lastFundamentalRef.current = fundamental
        windowStartTimeRef.current = now
        accumulatorRef.current.clear()
        lockedPredictionRef.current = null
        consecutiveStringCountRef.current = 0
        lastPredictedStringRef.current = null
        stringConfirmedRef.current = false
        setStablePrediction(null)
      }

      // Track consecutive same-string predictions
      if (result.stringIndex === lastPredictedStringRef.current) {
        consecutiveStringCountRef.current += 1
      } else {
        consecutiveStringCountRef.current = 1
        lastPredictedStringRef.current = result.stringIndex
      }

      // Require N consecutive same-string predictions before showing anything
      if (consecutiveStringCountRef.current >= CONSECUTIVE_STRING_THRESHOLD) {
        stringConfirmedRef.current = true
      }

      if (!stringConfirmedRef.current) {
        return
      }

      const windowStart = windowStartTimeRef.current
      const isInAccumulationWindow =
        windowStart !== null && now - windowStart < ACCUMULATION_WINDOW_MS

      if (isInAccumulationWindow) {
        const fret = calculateFret(fundamental, result.stringIndex)
        const key = `${result.stringIndex}-${fret}`
        const existing = accumulatorRef.current.get(key)

        if (existing) {
          existing.totalWeight += result.confidence
          existing.count += 1
        } else {
          accumulatorRef.current.set(key, {
            stringIndex: result.stringIndex,
            fret,
            totalWeight: result.confidence,
            count: 1,
          })
        }

        let bestPrediction: AccumulatedPrediction | null = null
        let bestWeight = 0
        accumulatorRef.current.forEach((pred) => {
          if (pred.totalWeight > bestWeight) {
            bestWeight = pred.totalWeight
            bestPrediction = pred
          }
        })

        if (bestPrediction) {
          const pred = bestPrediction as AccumulatedPrediction
          const stablePred: StablePrediction = {
            stringIndex: pred.stringIndex,
            stringLabel: STRING_LABELS[pred.stringIndex],
            fret: pred.fret,
            confidence: pred.totalWeight / pred.count,
            fundamental,
            isLocked: false,
          }
          setStablePrediction(stablePred)
        }
      } else if (windowStart !== null && !lockedPredictionRef.current) {
        let bestPrediction: AccumulatedPrediction | null = null
        let bestWeight = 0
        accumulatorRef.current.forEach((pred) => {
          if (pred.totalWeight > bestWeight) {
            bestWeight = pred.totalWeight
            bestPrediction = pred
          }
        })

        if (bestPrediction) {
          const pred = bestPrediction as AccumulatedPrediction
          const stablePred: StablePrediction = {
            stringIndex: pred.stringIndex,
            stringLabel: STRING_LABELS[pred.stringIndex],
            fret: pred.fret,
            confidence: pred.totalWeight / pred.count,
            fundamental,
            isLocked: true,
          }
          lockedPredictionRef.current = stablePred
          setStablePrediction(stablePred)
        }
      } else if (lockedPredictionRef.current) {
        setStablePrediction({ ...lockedPredictionRef.current, fundamental })
      }
    },
    [calculateFret],
  )

  const loadModel = useCallback(async () => {
    try {
      setStatus("loading")
      setError(null)
      isReleasedRef.current = false

      const scalerResponse = await fetch(scalerPathRef.current)
      if (!scalerResponse.ok) {
        throw new Error(`Failed to load scaler config from ${scalerPathRef.current}`)
      }
      scalerRef.current = await scalerResponse.json()

      sessionRef.current = await ort.InferenceSession.create(modelPathRef.current)

      setIsModelLoaded(true)
      setStatus("ready")
    } catch (err) {
      console.error("Failed to load model:", err)
      setError(err instanceof Error ? err.message : "Failed to load model")
      setStatus("error")
      setIsModelLoaded(false)
    }
  }, [])

  const runInference = useCallback(
    async (samples: Float32Array, sampleRate: number) => {
      const session = sessionRef.current
      const scaler = scalerRef.current

      if (!session || !scaler || isReleasedRef.current) return
      if (isInferenceRunningRef.current) return

      isInferenceRunningRef.current = true

      try {
        // Normalize audio amplitude to match training data levels
        const normalizedSamples = normalizeAudioAmplitude(samples, TARGET_RMS)
        const features = extractAllFeatures(normalizedSamples, sampleRate)
        const featureVector = featuresToVector(features)
        const normalizedFeatures = normalizeFeatures(featureVector, scaler.mean, scaler.scale)

        if (isReleasedRef.current) return

        const inputTensor = new ort.Tensor("float32", normalizedFeatures, [1, 33])
        const results = await session.run({ features: inputTensor })

        const logits = results.logits.data as Float32Array

        const maxLogit = Math.max(...logits)
        const expLogits = Array.from(logits).map((l) => Math.exp(l - maxLogit))
        const sumExp = expLogits.reduce((a, b) => a + b, 0)
        const probabilities = expLogits.map((e) => e / sumExp)

        let maxIdx = 0
        let maxProb = probabilities[0]
        for (let i = 1; i < probabilities.length; i++) {
          if (probabilities[i] > maxProb) {
            maxProb = probabilities[i]
            maxIdx = i
          }
        }

        if (maxProb >= minConfidenceRef.current) {
          const result: PredictionResult = {
            stringIndex: maxIdx,
            stringLabel: scaler.string_labels?.[maxIdx] ?? STRING_LABELS[maxIdx],
            confidence: maxProb,
            allProbabilities: probabilities,
            features,
            debug: debugRef.current
              ? {
                  rawFeatureVector: Array.from(featureVector),
                  normalizedFeatureVector: Array.from(normalizedFeatures),
                  sampleRate,
                  sampleCount: samples.length,
                  audioSamples: normalizedSamples,
                }
              : undefined,
          }

          setPrediction(result)
          onPredictionRef.current?.(result)

          if (productionModeRef.current) {
            processProductionModePrediction(result)
          }
        }
      } catch (err) {
        if (!isReleasedRef.current) {
          console.error("Inference error:", err)
        }
      } finally {
        isInferenceRunningRef.current = false
      }
    },
    [processProductionModePrediction],
  )

  const processAudioChunk = useCallback(
    (inputData: Float32Array, sampleRate: number) => {
      const audioBuffer = audioBufferRef.current
      if (!audioBuffer) return

      // Write new samples to the rolling buffer
      for (let i = 0; i < inputData.length; i++) {
        audioBuffer[bufferWriteIndexRef.current] = inputData[i]
        bufferWriteIndexRef.current = (bufferWriteIndexRef.current + 1) % audioBuffer.length
      }

      // Track samples accumulated since last window
      samplesSinceLastWindowRef.current += inputData.length

      // Process windows with HOP_SIZE interval (like Python's 50% overlap)
      while (samplesSinceLastWindowRef.current >= HOP_SIZE) {
        // Extract the most recent WINDOW_SIZE samples
        const window = new Float32Array(WINDOW_SIZE)
        const readStart =
          (bufferWriteIndexRef.current - WINDOW_SIZE + audioBuffer.length) % audioBuffer.length

        for (let i = 0; i < WINDOW_SIZE; i++) {
          window[i] = audioBuffer[(readStart + i) % audioBuffer.length]
        }

        // Check if window has enough energy (like Python's trim silence)
        const rms = calculateRMS(window)

        if (rms > MIN_RMS_THRESHOLD) {
          // Run inference on this window (non-blocking)
          runInference(window, sampleRate)
        } else if (productionModeRef.current) {
          // Silence detected - reset production mode state
          resetProductionModeState()
        }

        samplesSinceLastWindowRef.current -= HOP_SIZE
      }
    },
    [runInference, resetProductionModeState],
  )

  const startListening = useCallback(async () => {
    if (!isModelLoaded) {
      await loadModel()
    }

    if (!sessionRef.current || !scalerRef.current) {
      setError("Model not loaded")
      setStatus("error")
      return
    }

    try {
      setStatus("recording")
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

      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      const processor = audioContext.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        processAudioChunk(new Float32Array(inputData), audioContext.sampleRate)
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      // Allocate buffer for at least 2 windows (to handle overlap)
      audioBufferRef.current = new Float32Array(WINDOW_SIZE * 2)
      bufferWriteIndexRef.current = 0
      samplesSinceLastWindowRef.current = 0
    } catch (err) {
      console.error("Failed to start listening:", err)
      setError(err instanceof Error ? err.message : "Failed to start listening")
      setStatus("error")
    }
  }, [isModelLoaded, loadModel, processAudioChunk])

  const stopListening = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current.onaudioprocess = null
      processorRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    audioBufferRef.current = null
    bufferWriteIndexRef.current = 0
    samplesSinceLastWindowRef.current = 0

    resetProductionModeState()

    if (isModelLoaded) {
      setStatus("ready")
    } else {
      setStatus("idle")
    }
  }, [isModelLoaded, resetProductionModeState])

  const captureAudioSample = useCallback(() => {
    const audioContext = audioContextRef.current
    const audioBuffer = audioBufferRef.current

    if (!audioContext || !audioBuffer) return null

    // Return the most recent WINDOW_SIZE samples (matching Python's window)
    const window = new Float32Array(WINDOW_SIZE)
    const readStart =
      (bufferWriteIndexRef.current - WINDOW_SIZE + audioBuffer.length) % audioBuffer.length

    for (let i = 0; i < WINDOW_SIZE; i++) {
      window[i] = audioBuffer[(readStart + i) % audioBuffer.length]
    }

    return { samples: window, sampleRate: audioContext.sampleRate }
  }, [])

  useEffect(() => {
    return () => {
      isReleasedRef.current = true

      if (processorRef.current) {
        processorRef.current.disconnect()
        processorRef.current.onaudioprocess = null
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect()
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
      }

      if (sessionRef.current) {
        sessionRef.current.release()
      }
    }
  }, [])

  return {
    status,
    error,
    prediction,
    stablePrediction,
    startListening,
    stopListening,
    loadModel,
    isModelLoaded,
    captureAudioSample,
    scaler: scalerRef.current,
  }
}
