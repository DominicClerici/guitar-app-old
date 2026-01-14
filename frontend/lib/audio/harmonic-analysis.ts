"use client"

import type { HarmonicPeak, SpectralFeatures } from "./guitar-constants"

const DEFAULT_NUM_HARMONICS = 10
const HARMONIC_SEARCH_RANGE = 0.03
const MIN_PEAK_AMPLITUDE = 0.001

// Inharmonicity calculation tuning parameters
// Minimum amplitude ratio relative to fundamental to include a harmonic in regression
// Lower values include more harmonics (better for unwound strings with weaker upper harmonics)
const INHARMONICITY_MIN_AMPLITUDE_RATIO = 0.01
// Weight exponent for amplitude weighting (higher = stronger harmonics weighted more)
// Using 1.0 gives linear weighting, 2.0 gives quadratic, 0.5 gives sqrt
// Lower values (like 0.5) reduce the penalty for weaker harmonics
const INHARMONICITY_AMPLITUDE_WEIGHT_EXPONENT = 0.5
// Minimum number of valid harmonics required for inharmonicity calculation
const INHARMONICITY_MIN_HARMONICS = 2

export function getOptimalHarmonicCount(fundamentalFreq: number, sampleRate: number): number {
  const nyquist = sampleRate / 2
  const maxUsableHarmonic = Math.floor(nyquist / fundamentalFreq)

  let baseCount: number
  if (fundamentalFreq < 100) {
    baseCount = 18
  } else if (fundamentalFreq < 150) {
    baseCount = 15
  } else if (fundamentalFreq < 250) {
    baseCount = 12
  } else {
    baseCount = 10
  }

  return Math.min(baseCount, maxUsableHarmonic - 1)
}

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
  fundamentalFreq: number,
  numHarmonics: number = DEFAULT_NUM_HARMONICS
): HarmonicPeak[] {
  const peaks: HarmonicPeak[] = []

  for (let n = 1; n <= numHarmonics; n++) {
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

  const fundamental = peaks.find((p) => p.harmonicNumber === 1)
  if (!fundamental || fundamental.amplitude < MIN_PEAK_AMPLITUDE) return 0

  const validPeaks = peaks.filter((p) => {
    if (p.harmonicNumber < 2) return false
    if (Math.abs(p.deviationCents) >= 100) return false
    const amplitudeRatio = p.amplitude / fundamental.amplitude
    if (amplitudeRatio < INHARMONICITY_MIN_AMPLITUDE_RATIO) return false
    return true
  })

  if (validPeaks.length < INHARMONICITY_MIN_HARMONICS) return 0

  // Weighted linear regression: minimize sum(w_i * (y_i - (a + b*x_i))^2)
  // For inharmonicity: y = ratio^2 - 1, x = n^2 - 1, and we want slope B
  // Weight by amplitude ratio raised to the exponent
  let sumW = 0
  let sumWX = 0
  let sumWY = 0
  let sumWXY = 0
  let sumWXX = 0

  for (const peak of validPeaks) {
    const n = peak.harmonicNumber
    const x = n * n - 1
    const ratio = peak.actualFreq / peak.expectedFreq
    const y = ratio * ratio - 1

    const amplitudeRatio = peak.amplitude / fundamental.amplitude
    const weight = Math.pow(amplitudeRatio, INHARMONICITY_AMPLITUDE_WEIGHT_EXPONENT)

    sumW += weight
    sumWX += weight * x
    sumWY += weight * y
    sumWXY += weight * x * y
    sumWXX += weight * x * x
  }

  const denominator = sumW * sumWXX - sumWX * sumWX
  if (Math.abs(denominator) < 1e-10) return 0

  const B = (sumW * sumWXY - sumWX * sumWY) / denominator
  return Math.max(0, B)
}

export function getNormalizedHarmonicAmplitudes(
  peaks: HarmonicPeak[],
  numHarmonics: number = DEFAULT_NUM_HARMONICS
): number[] {
  const fundamental = peaks.find((p) => p.harmonicNumber === 1)
  if (!fundamental || fundamental.amplitude < MIN_PEAK_AMPLITUDE) {
    return new Array(numHarmonics).fill(0)
  }

  const normalized = new Array(numHarmonics).fill(0)
  for (const peak of peaks) {
    if (peak.harmonicNumber <= numHarmonics) {
      normalized[peak.harmonicNumber - 1] = peak.amplitude / fundamental.amplitude
    }
  }

  return normalized
}
