"use client"

import { freqFromAutocorr } from "@/lib/audio/autocorrelate"
import { createMelFilterbank } from "@/lib/audio/mfcc"
import FFT from "fft.js"
import * as ort from "onnxruntime-web"
import { useCallback, useEffect, useRef, useState } from "react"

// Match Python spec-nn/main.py exactly
// const WINDOW_SIZE = 4096 // ~93ms at 44.1kHz
// const N_FFT = 1024
// const HOP_LENGTH = 256
// const N_MELS = 64
const WINDOW_SIZE = 4096 // ~93ms at 44.1kHz
const N_FFT = WINDOW_SIZE
// const N_FFT = Math.floor(WINDOW_SIZE / 2)
const HOP_LENGTH = Math.floor(WINDOW_SIZE / 8)
const N_MELS = 64
const FMIN = 60.0
const FMAX = 5000.0
const TARGET_RMS = 0.035

// Inference trigger interval
const INFERENCE_HOP = 2048

// Minimum RMS energy to process a window
const MIN_RMS_THRESHOLD = 0.0015

// ScriptProcessor buffer size
const PROCESSOR_BUFFER_SIZE = 2048

// String frequencies for fret calculation
const STRING_FREQUENCIES = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63] // E2, A2, D3, G3, B3, E4
const STRING_LABELS = ["E2", "A2", "D3", "G3", "B3", "E4"]

export type SpectrogramClassifierStatus = "idle" | "loading" | "ready" | "recording" | "error"

export interface SpectrogramConfig {
  sample_rate: number
  window_size: number
  n_fft: number
  hop_length: number
  n_mels: number
  fmin: number
  fmax: number
  target_rms: number
}

export interface NormalizationConfig {
  mean: number
  std: number
}

export interface SpectrogramModelConfig {
  model_type: string
  input_shape: number[]
  num_classes: number
  string_labels: string[]
  normalization: NormalizationConfig
  spectrogram_config: SpectrogramConfig
}

export interface SpectrogramPredictionResult {
  stringIndex: number
  stringLabel: string
  confidence: number
  allProbabilities: number[]
  fundamental: number
  fret: number
}

export interface SpectrogramDebugData {
  timestamp: string
  sampleRate: number
  audioSamples: number[]
  spectrogramBeforeNorm: number[][]
  spectrogramAfterNorm: number[][]
  spectrogramShape: [number, number]
  config: {
    windowSize: number
    nFft: number
    hopLength: number
    nMels: number
    fmin: number
    fmax: number
    targetRms: number
  }
  normalization: {
    mean: number
    std: number
  }
}

interface UseSpectrogramClassifierOptions {
  modelPath?: string
  configPath?: string
  minConfidence?: number
  onPrediction?: (result: SpectrogramPredictionResult) => void
}

interface UseSpectrogramClassifierResult {
  status: SpectrogramClassifierStatus
  error: string | null
  prediction: SpectrogramPredictionResult | null
  startListening: () => Promise<void>
  stopListening: () => void
  loadModel: () => Promise<void>
  isModelLoaded: boolean
  captureDebugData: () => SpectrogramDebugData | null
}

const DEFAULT_MODEL_PATH = "/models/spec_classifier.onnx"
const DEFAULT_CONFIG_PATH = "/models/spec_config.json"
const DEFAULT_MIN_CONFIDENCE = 0.3

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

function computeMelSpectrogram(
  audio: Float32Array,
  sampleRate: number,
  nFft: number,
  hopLength: number,
  nMels: number,
  fmin: number,
  fmax: number,
): Float32Array {
  const melFilters = createMelFilterbank(sampleRate, nFft, nMels, fmin, fmax)
  const nBins = Math.floor(nFft / 2) + 1

  // Pad audio to match librosa's center=True behavior with pad_mode='constant' (zero padding)
  const padLength = Math.floor(nFft / 2)
  const paddedAudio = new Float32Array(audio.length + 2 * padLength)
  // Float32Array is initialized with zeros, so left and right padding are already zero
  // Just copy the original audio to the center
  paddedAudio.set(audio, padLength)

  // Hann window matching librosa
  const hannWindow = new Float32Array(nFft)
  for (let i = 0; i < nFft; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / nFft))
  }

  // Calculate number of frames using padded audio
  const numFrames = 1 + Math.floor((paddedAudio.length - nFft) / hopLength)

  if (numFrames <= 0) {
    return new Float32Array(nMels * 1)
  }

  const fft = new FFT(nFft)
  const melSpec: Float32Array[] = []

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopLength
    const end = start + nFft

    if (end > paddedAudio.length) break

    // Apply window
    const frameSamples = new Float32Array(nFft)
    for (let i = 0; i < nFft; i++) {
      frameSamples[i] = paddedAudio[start + i] * hannWindow[i]
    }

    // Compute FFT
    const out = fft.createComplexArray()
    fft.realTransform(out, frameSamples)

    // Compute power spectrum
    const powerSpectrum = new Float32Array(nBins)
    for (let i = 0; i < nBins; i++) {
      const re = out[2 * i]
      const im = out[2 * i + 1]
      powerSpectrum[i] = re * re + im * im
    }

    // Apply mel filterbank
    const melEnergies = new Float32Array(nMels)
    for (let m = 0; m < nMels; m++) {
      let energy = 0
      for (let k = 0; k < nBins; k++) {
        energy += powerSpectrum[k] * melFilters[m][k]
      }
      melEnergies[m] = energy
    }

    melSpec.push(melEnergies)
  }

  // Convert to dB scale using max as reference (matching Python: ref=np.max)
  // First find global max power value
  const amin = 1e-10
  const topDb = 80.0
  let globalMaxPower = amin
  for (const frame of melSpec) {
    for (let m = 0; m < nMels; m++) {
      if (frame[m] > globalMaxPower) {
        globalMaxPower = frame[m]
      }
    }
  }

  // Convert to dB with ref=globalMax (so max becomes 0 dB)
  // This matches librosa.power_to_db(mel_spec, ref=np.max)
  const actualNumFrames = melSpec.length
  const result = new Float32Array(nMels * actualNumFrames)
  const logRef = 10.0 * Math.log10(Math.max(amin, globalMaxPower))

  for (let f = 0; f < actualNumFrames; f++) {
    for (let m = 0; m < nMels; m++) {
      const logSpec = 10.0 * Math.log10(Math.max(amin, melSpec[f][m])) - logRef
      // Store in [n_mels, time_frames] layout
      result[m * actualNumFrames + f] = logSpec
    }
  }

  // Apply top_db clipping globally (threshold is global max dB - topDb)
  // Since ref=max, global max dB is 0, so threshold is -topDb
  const threshold = -topDb
  for (let i = 0; i < result.length; i++) {
    if (result[i] < threshold) {
      result[i] = threshold
    }
  }

  return result
}

function calculateFret(fundamental: number, stringIndex: number): number {
  const baseFreq = STRING_FREQUENCIES[stringIndex]
  const semitones = 12 * Math.log2(fundamental / baseFreq)
  const fret = Math.round(semitones)
  return Math.max(0, Math.min(24, fret))
}

export function useSpectrogramClassifier(
  options: UseSpectrogramClassifierOptions = {},
): UseSpectrogramClassifierResult {
  const [status, setStatus] = useState<SpectrogramClassifierStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<SpectrogramPredictionResult | null>(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)

  const modelPathRef = useRef(options.modelPath ?? DEFAULT_MODEL_PATH)
  const configPathRef = useRef(options.configPath ?? DEFAULT_CONFIG_PATH)
  const minConfidenceRef = useRef(options.minConfidence ?? DEFAULT_MIN_CONFIDENCE)
  const onPredictionRef = useRef(options.onPrediction)

  const sessionRef = useRef<ort.InferenceSession | null>(null)
  const configRef = useRef<SpectrogramModelConfig | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const isInferenceRunningRef = useRef(false)
  const isReleasedRef = useRef(false)

  // Rolling buffer to accumulate audio samples
  const audioBufferRef = useRef<Float32Array | null>(null)
  const bufferWriteIndexRef = useRef(0)
  const samplesSinceLastInferenceRef = useRef(0)

  // Store last detected fundamental for fret calculation
  const lastFundamentalRef = useRef<number>(0)

  // Debug data capture refs
  const lastAudioSamplesRef = useRef<Float32Array | null>(null)
  const lastSpectrogramBeforeNormRef = useRef<Float32Array | null>(null)
  const lastSpectrogramAfterNormRef = useRef<Float32Array | null>(null)
  const lastSpectrogramShapeRef = useRef<[number, number]>([0, 0])
  const lastSampleRateRef = useRef<number>(44100)

  useEffect(() => {
    modelPathRef.current = options.modelPath ?? DEFAULT_MODEL_PATH
    configPathRef.current = options.configPath ?? DEFAULT_CONFIG_PATH
    minConfidenceRef.current = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE
    onPredictionRef.current = options.onPrediction
  }, [options.modelPath, options.configPath, options.minConfidence, options.onPrediction])

  const loadModel = useCallback(async () => {
    try {
      setStatus("loading")
      setError(null)
      isReleasedRef.current = false

      // Load config
      const configResponse = await fetch(configPathRef.current)
      if (!configResponse.ok) {
        throw new Error(`Failed to load config from ${configPathRef.current}`)
      }
      configRef.current = await configResponse.json()

      // Load ONNX model
      sessionRef.current = await ort.InferenceSession.create(modelPathRef.current)

      setIsModelLoaded(true)
      setStatus("ready")
    } catch (err) {
      console.error("Failed to load spectrogram model:", err)
      setError(err instanceof Error ? err.message : "Failed to load model")
      setStatus("error")
      setIsModelLoaded(false)
    }
  }, [])

  const runInference = useCallback(async (samples: Float32Array, sampleRate: number) => {
    const session = sessionRef.current
    const config = configRef.current

    if (!session || !config || isReleasedRef.current) return
    if (isInferenceRunningRef.current) return

    isInferenceRunningRef.current = true

    try {
      // Normalize audio amplitude to match training data
      const normalizedSamples = normalizeAudioAmplitude(samples, TARGET_RMS)

      // Detect fundamental frequency using autocorrelation
      let fundamental = 0
      try {
        fundamental = freqFromAutocorr(normalizedSamples, sampleRate)
        if (fundamental > 20 && fundamental < 5000) {
          lastFundamentalRef.current = fundamental
        } else {
          fundamental = lastFundamentalRef.current
        }
      } catch {
        fundamental = lastFundamentalRef.current
      }

      // Compute mel-spectrogram
      const melSpec = computeMelSpectrogram(
        normalizedSamples,
        sampleRate,
        N_FFT,
        HOP_LENGTH,
        N_MELS,
        FMIN,
        FMAX,
      )

      // Store debug data before normalization
      lastAudioSamplesRef.current = normalizedSamples
      lastSampleRateRef.current = sampleRate

      // Check if we have the expected shape
      const expectedTimeFrames = config.input_shape[2]
      const actualTimeFrames = melSpec.length / N_MELS

      if (actualTimeFrames < expectedTimeFrames) {
        // Not enough frames, skip
        isInferenceRunningRef.current = false
        return
      }

      // Take only the expected number of frames (from the end if we have more)
      let inputData: Float32Array
      if (actualTimeFrames > expectedTimeFrames) {
        // Reshape to take last expectedTimeFrames
        inputData = new Float32Array(N_MELS * expectedTimeFrames)
        const startFrame = actualTimeFrames - expectedTimeFrames
        for (let m = 0; m < N_MELS; m++) {
          for (let t = 0; t < expectedTimeFrames; t++) {
            inputData[m * expectedTimeFrames + t] = melSpec[m * actualTimeFrames + startFrame + t]
          }
        }
      } else {
        inputData = melSpec
      }

      // Store spectrogram before normalization
      lastSpectrogramBeforeNormRef.current = new Float32Array(inputData)
      lastSpectrogramShapeRef.current = [N_MELS, expectedTimeFrames]

      // Normalize spectrogram using mean/std from config
      const mean = config.normalization.mean
      const std = config.normalization.std
      for (let i = 0; i < inputData.length; i++) {
        inputData[i] = (inputData[i] - mean) / std
      }

      // Store spectrogram after normalization
      lastSpectrogramAfterNormRef.current = new Float32Array(inputData)

      if (isReleasedRef.current) return

      // Create input tensor with shape [1, 1, n_mels, time_frames]
      const inputTensor = new ort.Tensor("float32", inputData, [1, 1, N_MELS, expectedTimeFrames])

      // Run inference
      const results = await session.run({ spectrogram: inputTensor })
      const logits = results.logits.data as Float32Array

      // Softmax
      const maxLogit = Math.max(...logits)
      const expLogits = Array.from(logits).map((l) => Math.exp(l - maxLogit))
      const sumExp = expLogits.reduce((a, b) => a + b, 0)
      const probabilities = expLogits.map((e) => e / sumExp)

      // Find max prediction
      let maxIdx = 0
      let maxProb = probabilities[0]
      for (let i = 1; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i]
          maxIdx = i
        }
      }

      if (maxProb >= minConfidenceRef.current) {
        const fret = fundamental > 0 ? calculateFret(fundamental, maxIdx) : 0

        const result: SpectrogramPredictionResult = {
          stringIndex: maxIdx,
          stringLabel: config.string_labels?.[maxIdx] ?? STRING_LABELS[maxIdx],
          confidence: maxProb,
          allProbabilities: probabilities,
          fundamental,
          fret,
        }

        setPrediction(result)
        onPredictionRef.current?.(result)
      }
    } catch (err) {
      if (!isReleasedRef.current) {
        console.error("Spectrogram inference error:", err)
      }
    } finally {
      isInferenceRunningRef.current = false
    }
  }, [])

  const processAudioChunk = useCallback(
    (inputData: Float32Array, sampleRate: number) => {
      const audioBuffer = audioBufferRef.current
      if (!audioBuffer) return

      // Write new samples to the rolling buffer
      for (let i = 0; i < inputData.length; i++) {
        audioBuffer[bufferWriteIndexRef.current] = inputData[i]
        bufferWriteIndexRef.current = (bufferWriteIndexRef.current + 1) % audioBuffer.length
      }

      // Track samples accumulated since last inference
      samplesSinceLastInferenceRef.current += inputData.length

      // Trigger inference every INFERENCE_HOP samples
      while (samplesSinceLastInferenceRef.current >= INFERENCE_HOP) {
        // Extract the most recent WINDOW_SIZE samples
        const window = new Float32Array(WINDOW_SIZE)
        const readStart =
          (bufferWriteIndexRef.current - WINDOW_SIZE + audioBuffer.length) % audioBuffer.length

        for (let i = 0; i < WINDOW_SIZE; i++) {
          window[i] = audioBuffer[(readStart + i) % audioBuffer.length]
        }

        // Check if window has enough energy
        const rms = calculateRMS(window)

        if (rms > MIN_RMS_THRESHOLD) {
          runInference(window, sampleRate)
        }

        samplesSinceLastInferenceRef.current -= INFERENCE_HOP
      }
    },
    [runInference],
  )

  const startListening = useCallback(async () => {
    if (!isModelLoaded) {
      await loadModel()
    }

    if (!sessionRef.current || !configRef.current) {
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

      const audioContext = new AudioContext({
        sampleRate: 48000,
      })
      console.log("Browser sample rate:", audioContext.sampleRate)

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

      // Allocate buffer for at least 2 windows
      audioBufferRef.current = new Float32Array(WINDOW_SIZE * 2)
      bufferWriteIndexRef.current = 0
      samplesSinceLastInferenceRef.current = 0
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
    samplesSinceLastInferenceRef.current = 0

    if (isModelLoaded) {
      setStatus("ready")
    } else {
      setStatus("idle")
    }
  }, [isModelLoaded])

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

  const captureDebugData = useCallback((): SpectrogramDebugData | null => {
    const config = configRef.current
    if (
      !lastAudioSamplesRef.current ||
      !lastSpectrogramBeforeNormRef.current ||
      !lastSpectrogramAfterNormRef.current ||
      !config
    ) {
      return null
    }

    const [nMels, timeFrames] = lastSpectrogramShapeRef.current

    // Convert flat spectrogram array to 2D array [n_mels][time_frames]
    const specBeforeNorm: number[][] = []
    const specAfterNorm: number[][] = []
    for (let m = 0; m < nMels; m++) {
      const rowBefore: number[] = []
      const rowAfter: number[] = []
      for (let t = 0; t < timeFrames; t++) {
        rowBefore.push(lastSpectrogramBeforeNormRef.current[m * timeFrames + t])
        rowAfter.push(lastSpectrogramAfterNormRef.current[m * timeFrames + t])
      }
      specBeforeNorm.push(rowBefore)
      specAfterNorm.push(rowAfter)
    }

    return {
      timestamp: new Date().toISOString(),
      sampleRate: lastSampleRateRef.current,
      audioSamples: Array.from(lastAudioSamplesRef.current),
      spectrogramBeforeNorm: specBeforeNorm,
      spectrogramAfterNorm: specAfterNorm,
      spectrogramShape: lastSpectrogramShapeRef.current,
      config: {
        windowSize: WINDOW_SIZE,
        nFft: N_FFT,
        hopLength: HOP_LENGTH,
        nMels: N_MELS,
        fmin: FMIN,
        fmax: FMAX,
        targetRms: TARGET_RMS,
      },
      normalization: {
        mean: config.normalization.mean,
        std: config.normalization.std,
      },
    }
  }, [])

  return {
    status,
    error,
    prediction,
    startListening,
    stopListening,
    loadModel,
    isModelLoaded,
    captureDebugData,
  }
}
