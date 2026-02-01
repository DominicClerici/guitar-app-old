"use client"

import { freqFromAutocorr } from "@/lib/audio/autocorrelate"
import { useCallback, useEffect, useRef, useState } from "react"

export type AutocorrelationStatus = "idle" | "requesting" | "recording" | "error"

export interface PitchResult {
  frequency: number
  confidence: number
}

interface UseAutocorrelationOptions {
  windowSize?: number
  hopSize?: number
  minRmsThreshold?: number
  onPitchDetected?: (result: PitchResult) => void
}

interface UseAutocorrelationResult {
  status: AutocorrelationStatus
  error: string | null
  pitch: PitchResult | null
  sampleRate: number
  startListening: () => Promise<void>
  stopListening: () => void
}

const DEFAULT_WINDOW_SIZE = 4096
const DEFAULT_HOP_SIZE = DEFAULT_WINDOW_SIZE / 2
const DEFAULT_MIN_RMS = 0.0015
const PROCESSOR_BUFFER_SIZE = DEFAULT_WINDOW_SIZE / 2

function calculateRMS(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i]
  }
  return Math.sqrt(sum / samples.length)
}

function estimateConfidence(samples: Float32Array): number {
  const rms = calculateRMS(samples)
  const normalizedRms = Math.min(rms / 0.1, 1)

  let zeroCrossings = 0
  for (let i = 1; i < samples.length; i++) {
    if (samples[i] >= 0 !== samples[i - 1] >= 0) {
      zeroCrossings++
    }
  }
  const zcRate = zeroCrossings / samples.length
  const periodicityScore = Math.max(0, 1 - zcRate * 10)

  return Math.min(1, normalizedRms * 0.5 + periodicityScore * 0.5)
}

export function useAutocorrelation(
  options: UseAutocorrelationOptions = {},
): UseAutocorrelationResult {
  const [status, setStatus] = useState<AutocorrelationStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [pitch, setPitch] = useState<PitchResult | null>(null)
  const [sampleRate, setSampleRate] = useState(44100)

  const windowSizeRef = useRef(options.windowSize ?? DEFAULT_WINDOW_SIZE)
  const hopSizeRef = useRef(options.hopSize ?? DEFAULT_HOP_SIZE)
  const minRmsRef = useRef(options.minRmsThreshold ?? DEFAULT_MIN_RMS)
  const onPitchDetectedRef = useRef(options.onPitchDetected)

  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  const audioBufferRef = useRef<Float32Array | null>(null)
  const bufferWriteIndexRef = useRef(0)
  const samplesSinceLastWindowRef = useRef(0)
  const isProcessingRef = useRef(false)

  useEffect(() => {
    windowSizeRef.current = options.windowSize ?? DEFAULT_WINDOW_SIZE
    hopSizeRef.current = options.hopSize ?? DEFAULT_HOP_SIZE
    minRmsRef.current = options.minRmsThreshold ?? DEFAULT_MIN_RMS
    onPitchDetectedRef.current = options.onPitchDetected
  }, [options.windowSize, options.hopSize, options.minRmsThreshold, options.onPitchDetected])

  const detectPitch = useCallback((samples: Float32Array, sr: number) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    try {
      const frequency = freqFromAutocorr(samples, sr)

      if (frequency > 20 && frequency < 5000) {
        const confidence = estimateConfidence(samples)
        const result: PitchResult = { frequency, confidence }
        setPitch(result)
        onPitchDetectedRef.current?.(result)
      }
    } catch {
      // No valid frequency found - signal may not be periodic
    } finally {
      isProcessingRef.current = false
    }
  }, [])

  const processAudioChunk = useCallback(
    (inputData: Float32Array, sr: number) => {
      const audioBuffer = audioBufferRef.current
      if (!audioBuffer) return

      const windowSize = windowSizeRef.current
      const hopSize = hopSizeRef.current

      for (let i = 0; i < inputData.length; i++) {
        audioBuffer[bufferWriteIndexRef.current] = inputData[i]
        bufferWriteIndexRef.current = (bufferWriteIndexRef.current + 1) % audioBuffer.length
      }

      samplesSinceLastWindowRef.current += inputData.length

      while (samplesSinceLastWindowRef.current >= hopSize) {
        const window = new Float32Array(windowSize)
        const readStart =
          (bufferWriteIndexRef.current - windowSize + audioBuffer.length) % audioBuffer.length

        for (let i = 0; i < windowSize; i++) {
          window[i] = audioBuffer[(readStart + i) % audioBuffer.length]
        }

        const rms = calculateRMS(window)
        if (rms > minRmsRef.current) {
          detectPitch(window, sr)
        }

        samplesSinceLastWindowRef.current -= hopSize
      }
    },
    [detectPitch],
  )

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

      const windowSize = windowSizeRef.current
      audioBufferRef.current = new Float32Array(windowSize * 2)
      bufferWriteIndexRef.current = 0
      samplesSinceLastWindowRef.current = 0

      setStatus("recording")
    } catch (err) {
      console.error("Failed to start listening:", err)
      setError(err instanceof Error ? err.message : "Failed to start listening")
      setStatus("error")
    }
  }, [processAudioChunk])

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

    setStatus("idle")
  }, [])

  useEffect(() => {
    return () => {
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
    }
  }, [])

  return {
    status,
    error,
    pitch,
    sampleRate,
    startListening,
    stopListening,
  }
}
