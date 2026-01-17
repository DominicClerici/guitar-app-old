"use client"

import FFT from "fft.js"

export interface DetectedPartial {
  harmonicNumber: number
  expectedFreq: number
  actualFreq: number
  amplitude: number
  bEstimate: number
}

export interface FFTAnalysisResult {
  partials: DetectedPartial[]
  estimatedB: number
  confidence: number
  spectralCentroid: number
}

const fftCache = new Map<number, FFT>()

function getFFT(size: number): FFT {
  if (!fftCache.has(size)) {
    fftCache.set(size, new FFT(size))
  }
  return fftCache.get(size)!
}

export function applyHannWindow(buffer: Float32Array): Float32Array {
  const windowed = new Float32Array(buffer.length)
  for (let i = 0; i < buffer.length; i++) {
    const multiplier = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (buffer.length - 1)))
    windowed[i] = buffer[i] * multiplier
  }
  return windowed
}

export function computeFFTMagnitudes(timeDomainData: Float32Array): Float32Array {
  const n = timeDomainData.length
  const fft = getFFT(n)

  const complexOutput = fft.createComplexArray()
  fft.realTransform(complexOutput, timeDomainData)
  fft.completeSpectrum(complexOutput)

  const magnitudes = new Float32Array(n / 2)
  for (let i = 0; i < n / 2; i++) {
    const real = complexOutput[2 * i]
    const imag = complexOutput[2 * i + 1]
    magnitudes[i] = Math.sqrt(real * real + imag * imag)
  }

  return magnitudes
}

export function parabolicInterpolation(
  magnitudes: Float32Array,
  peakIndex: number,
  sampleRate: number,
  fftSize: number
): { frequency: number; amplitude: number } {
  if (peakIndex <= 0 || peakIndex >= magnitudes.length - 1) {
    return {
      frequency: (peakIndex * sampleRate) / fftSize,
      amplitude: magnitudes[peakIndex],
    }
  }

  const y1 = magnitudes[peakIndex - 1]
  const y2 = magnitudes[peakIndex]
  const y3 = magnitudes[peakIndex + 1]

  const denominator = y1 - 2 * y2 + y3
  if (Math.abs(denominator) < 1e-10) {
    return {
      frequency: (peakIndex * sampleRate) / fftSize,
      amplitude: y2,
    }
  }

  const delta = (0.5 * (y1 - y3)) / denominator
  const trueBin = peakIndex + delta
  const interpolatedAmplitude = y2 - 0.25 * (y1 - y3) * delta

  return {
    frequency: (trueBin * sampleRate) / fftSize,
    amplitude: interpolatedAmplitude,
  }
}

export function findPeakNearFrequency(
  magnitudes: Float32Array,
  targetFreq: number,
  sampleRate: number,
  fftSize: number,
  searchRangeCents: number = 100
): { peakIndex: number; amplitude: number } | null {
  const binResolution = sampleRate / fftSize
  const targetBin = targetFreq / binResolution

  const searchRangeRatio = Math.pow(2, searchRangeCents / 1200)
  const minBin = Math.max(1, Math.floor(targetBin / searchRangeRatio))
  const maxBin = Math.min(magnitudes.length - 2, Math.ceil(targetBin * searchRangeRatio))

  let maxAmplitude = -Infinity
  let peakIndex = -1

  for (let i = minBin; i <= maxBin; i++) {
    if (magnitudes[i] > magnitudes[i - 1] && magnitudes[i] > magnitudes[i + 1]) {
      if (magnitudes[i] > maxAmplitude) {
        maxAmplitude = magnitudes[i]
        peakIndex = i
      }
    }
  }

  if (peakIndex === -1) {
    for (let i = minBin; i <= maxBin; i++) {
      if (magnitudes[i] > maxAmplitude) {
        maxAmplitude = magnitudes[i]
        peakIndex = i
      }
    }
  }

  if (peakIndex === -1 || maxAmplitude < 1e-6) {
    return null
  }

  return { peakIndex, amplitude: maxAmplitude }
}

export function calculateInharmonicityFromPartial(
  actualFreq: number,
  fundamental: number,
  harmonicNumber: number
): number {
  const idealFreq = harmonicNumber * fundamental
  const ratio = actualFreq / idealFreq
  const ratioSquared = ratio * ratio
  const b = (ratioSquared - 1) / (harmonicNumber * harmonicNumber)
  return Math.max(0, b)
}

export function analyzeInharmonicity(
  timeDomainData: Float32Array,
  fundamental: number,
  sampleRate: number,
  maxHarmonic: number = 10,
  minAmplitudeThreshold: number = 0.01
): FFTAnalysisResult {
  const windowed = applyHannWindow(timeDomainData)
  const magnitudes = computeFFTMagnitudes(windowed)
  const fftSize = timeDomainData.length

  const partials: DetectedPartial[] = []
  const bEstimates: number[] = []

  const fundamentalPeak = findPeakNearFrequency(magnitudes, fundamental, sampleRate, fftSize, 50)
  const fundamentalAmplitude = fundamentalPeak?.amplitude ?? 1

  for (let n = 2; n <= maxHarmonic; n++) {
    const expectedFreq = n * fundamental

    if (expectedFreq > sampleRate / 2 - 100) break

    const peak = findPeakNearFrequency(magnitudes, expectedFreq, sampleRate, fftSize, 80)
    if (!peak) continue

    const interpolated = parabolicInterpolation(magnitudes, peak.peakIndex, sampleRate, fftSize)

    const relativeAmplitude = interpolated.amplitude / fundamentalAmplitude
    if (relativeAmplitude < minAmplitudeThreshold) continue

    const bEstimate = calculateInharmonicityFromPartial(interpolated.frequency, fundamental, n)

    if (bEstimate >= 0 && bEstimate < 0.01) {
      partials.push({
        harmonicNumber: n,
        expectedFreq,
        actualFreq: interpolated.frequency,
        amplitude: interpolated.amplitude,
        bEstimate,
      })
      bEstimates.push(bEstimate)
    }
  }

  let estimatedB = 0
  let confidence = 0

  if (bEstimates.length > 0) {
    bEstimates.sort((a, b) => a - b)
    const trimCount = Math.floor(bEstimates.length * 0.2)
    const trimmedEstimates =
      bEstimates.slice(trimCount, bEstimates.length - trimCount || undefined)

    if (trimmedEstimates.length > 0) {
      estimatedB = trimmedEstimates.reduce((a, b) => a + b, 0) / trimmedEstimates.length
    } else {
      estimatedB = bEstimates[Math.floor(bEstimates.length / 2)]
    }

    const variance =
      bEstimates.reduce((sum, b) => sum + Math.pow(b - estimatedB, 2), 0) / bEstimates.length
    const stdDev = Math.sqrt(variance)
    const coefficientOfVariation = estimatedB > 0 ? stdDev / estimatedB : 1

    confidence = Math.max(0, Math.min(1, 1 - coefficientOfVariation))
    confidence *= Math.min(1, partials.length / 5)
  }

  const spectralCentroid = calculateSpectralCentroid(magnitudes, sampleRate, fftSize)

  return {
    partials,
    estimatedB,
    confidence,
    spectralCentroid,
  }
}

export function calculateSpectralCentroid(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number
): number {
  let weightedSum = 0
  let totalMagnitude = 0

  const binResolution = sampleRate / fftSize

  for (let i = 1; i < magnitudes.length; i++) {
    const frequency = i * binResolution
    weightedSum += frequency * magnitudes[i]
    totalMagnitude += magnitudes[i]
  }

  if (totalMagnitude === 0) return 0
  return weightedSum / totalMagnitude
}
