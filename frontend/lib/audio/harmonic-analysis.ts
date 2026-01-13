"use client"

import type { HarmonicPeak, SpectralFeatures } from "./guitar-constants"

const NUM_HARMONICS = 10
const HARMONIC_SEARCH_RANGE = 0.03
const MIN_PEAK_AMPLITUDE = 0.001

export function computeMagnitudeSpectrum(
  analyser: AnalyserNode,
  fftSize: number
): { frequencies: Float32Array; magnitudes: Float32Array } {
  const frequencyData = new Float32Array(fftSize / 2)
  analyser.getFloatFrequencyData(frequencyData)

  const magnitudes = new Float32Array(fftSize / 2)
  for (let i = 0; i < frequencyData.length; i++) {
    magnitudes[i] = Math.pow(10, frequencyData[i] / 20)
  }

  const sampleRate = analyser.context.sampleRate
  const frequencies = new Float32Array(fftSize / 2)
  for (let i = 0; i < frequencies.length; i++) {
    frequencies[i] = (i * sampleRate) / fftSize
  }

  return { frequencies, magnitudes }
}

function findPeakInRange(
  frequencies: Float32Array,
  magnitudes: Float32Array,
  targetFreq: number,
  range: number
): { freq: number; amplitude: number } | null {
  const minFreq = targetFreq * (1 - range)
  const maxFreq = targetFreq * (1 + range)

  let maxAmp = MIN_PEAK_AMPLITUDE
  let peakIdx = -1

  for (let i = 0; i < frequencies.length; i++) {
    if (frequencies[i] >= minFreq && frequencies[i] <= maxFreq) {
      if (magnitudes[i] > maxAmp) {
        maxAmp = magnitudes[i]
        peakIdx = i
      }
    }
  }

  if (peakIdx === -1) return null

  const refinedFreq = parabolicInterpolation(frequencies, magnitudes, peakIdx)
  return { freq: refinedFreq, amplitude: maxAmp }
}

function parabolicInterpolation(
  frequencies: Float32Array,
  magnitudes: Float32Array,
  peakIdx: number
): number {
  if (peakIdx <= 0 || peakIdx >= magnitudes.length - 1) {
    return frequencies[peakIdx]
  }

  const alpha = magnitudes[peakIdx - 1]
  const beta = magnitudes[peakIdx]
  const gamma = magnitudes[peakIdx + 1]

  const denominator = alpha - 2 * beta + gamma
  if (Math.abs(denominator) < 1e-10) {
    return frequencies[peakIdx]
  }

  const p = 0.5 * (alpha - gamma) / denominator
  const freqStep = frequencies[1] - frequencies[0]
  return frequencies[peakIdx] + p * freqStep
}

export function detectHarmonicPeaks(
  frequencies: Float32Array,
  magnitudes: Float32Array,
  fundamentalFreq: number
): HarmonicPeak[] {
  const peaks: HarmonicPeak[] = []

  for (let n = 1; n <= NUM_HARMONICS; n++) {
    const expectedFreq = n * fundamentalFreq
    const peak = findPeakInRange(frequencies, magnitudes, expectedFreq, HARMONIC_SEARCH_RANGE)

    if (peak) {
      const deviationCents = 1200 * Math.log2(peak.freq / expectedFreq)
      peaks.push({
        harmonicNumber: n,
        expectedFreq,
        actualFreq: peak.freq,
        amplitude: peak.amplitude,
        deviationCents,
      })
    }
  }

  return peaks
}

export function calculateSpectralFeatures(
  frequencies: Float32Array,
  magnitudes: Float32Array
): SpectralFeatures {
  let totalMagnitude = 0
  let weightedSum = 0
  let squaredWeightedSum = 0

  for (let i = 0; i < magnitudes.length; i++) {
    totalMagnitude += magnitudes[i]
    weightedSum += frequencies[i] * magnitudes[i]
    squaredWeightedSum += frequencies[i] * frequencies[i] * magnitudes[i]
  }

  const centroid = totalMagnitude > 0 ? weightedSum / totalMagnitude : 0
  const variance =
    totalMagnitude > 0 ? squaredWeightedSum / totalMagnitude - centroid * centroid : 0
  const spread = Math.sqrt(Math.max(0, variance))

  let cumulativeMagnitude = 0
  const rolloffThreshold = 0.85 * totalMagnitude
  let rolloff = frequencies[frequencies.length - 1]

  for (let i = 0; i < magnitudes.length; i++) {
    cumulativeMagnitude += magnitudes[i]
    if (cumulativeMagnitude >= rolloffThreshold) {
      rolloff = frequencies[i]
      break
    }
  }

  let geometricSum = 0
  let arithmeticSum = 0
  let count = 0

  for (let i = 0; i < magnitudes.length; i++) {
    if (magnitudes[i] > MIN_PEAK_AMPLITUDE) {
      geometricSum += Math.log(magnitudes[i])
      arithmeticSum += magnitudes[i]
      count++
    }
  }

  const flatness =
    count > 0 && arithmeticSum > 0
      ? Math.exp(geometricSum / count) / (arithmeticSum / count)
      : 0

  return { centroid, rolloff, spread, flatness }
}

export function calculateInharmonicityCoefficient(peaks: HarmonicPeak[]): number {
  if (peaks.length < 3) return 0

  const validPeaks = peaks.filter((p) => p.harmonicNumber >= 2 && Math.abs(p.deviationCents) < 100)
  if (validPeaks.length < 2) return 0

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  for (const peak of validPeaks) {
    const n = peak.harmonicNumber
    const x = n * n - 1
    const ratio = peak.actualFreq / peak.expectedFreq
    const y = ratio * ratio - 1

    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }

  const n = validPeaks.length
  const denominator = n * sumXX - sumX * sumX
  if (Math.abs(denominator) < 1e-10) return 0

  const B = (n * sumXY - sumX * sumY) / denominator
  return Math.max(0, B)
}

export function getNormalizedHarmonicAmplitudes(peaks: HarmonicPeak[]): number[] {
  const fundamental = peaks.find((p) => p.harmonicNumber === 1)
  if (!fundamental || fundamental.amplitude < MIN_PEAK_AMPLITUDE) {
    return new Array(NUM_HARMONICS).fill(0)
  }

  const normalized = new Array(NUM_HARMONICS).fill(0)
  for (const peak of peaks) {
    if (peak.harmonicNumber <= NUM_HARMONICS) {
      normalized[peak.harmonicNumber - 1] = peak.amplitude / fundamental.amplitude
    }
  }

  return normalized
}
