"use client"

export interface AttackFeatures {
  attackSlope: number
  timeToPeak: number
  noiseRatio: number
  transientSharpness: number
}

const ATTACK_WINDOW_MS = 100
const RMS_WINDOW_MS = 3
const ONSET_THRESHOLD_MULTIPLIER = 2.0
const MIN_RMS_THRESHOLD = 0.001

function calculateRMS(samples: Float32Array, start: number, length: number): number {
  let sumSquares = 0
  const end = Math.min(start + length, samples.length)
  const actualLength = end - start

  if (actualLength <= 0) return 0

  for (let i = start; i < end; i++) {
    sumSquares += samples[i] * samples[i]
  }

  return Math.sqrt(sumSquares / actualLength)
}

function amplitudeToDb(amplitude: number): number {
  return 20 * Math.log10(Math.max(amplitude, 1e-10))
}

function findOnsetIndex(rmsEnvelope: number[], noiseFloor: number): number {
  const threshold = Math.max(noiseFloor * ONSET_THRESHOLD_MULTIPLIER, MIN_RMS_THRESHOLD)

  for (let i = 0; i < rmsEnvelope.length; i++) {
    if (rmsEnvelope[i] > threshold) {
      return i
    }
  }

  return 0
}

function findPeakIndex(rmsEnvelope: number[], onsetIndex: number, maxSearchIndex: number): number {
  let peakIndex = onsetIndex
  let peakValue = rmsEnvelope[onsetIndex] ?? 0

  const searchEnd = Math.min(maxSearchIndex, rmsEnvelope.length)

  for (let i = onsetIndex; i < searchEnd; i++) {
    if (rmsEnvelope[i] > peakValue) {
      peakValue = rmsEnvelope[i]
      peakIndex = i
    }
  }

  return peakIndex
}

function calculateNoiseFloor(rmsEnvelope: number[], windowSize: number): number {
  if (rmsEnvelope.length === 0) return MIN_RMS_THRESHOLD

  const sortedValues = [...rmsEnvelope.slice(0, windowSize)].sort((a, b) => a - b)
  const medianIndex = Math.floor(sortedValues.length / 4)

  return sortedValues[medianIndex] ?? MIN_RMS_THRESHOLD
}

function estimateNoiseRatio(
  audioBuffer: Float32Array,
  sampleRate: number,
  fundamentalFreq: number,
  attackDurationSamples: number,
): number {
  const attackSamples = audioBuffer.slice(0, attackDurationSamples)
  if (attackSamples.length === 0) return 0.5

  const fftSize = Math.min(2048, Math.pow(2, Math.ceil(Math.log2(attackSamples.length))))
  const paddedSamples = new Float32Array(fftSize)
  paddedSamples.set(attackSamples.slice(0, fftSize))

  const real = new Float32Array(fftSize)
  const imag = new Float32Array(fftSize)

  for (let i = 0; i < fftSize; i++) {
    real[i] = paddedSamples[i]
    imag[i] = 0
  }

  fftInPlace(real, imag)

  const magnitudes = new Float32Array(fftSize / 2)
  for (let i = 0; i < fftSize / 2; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i])
  }

  let harmonicEnergy = 0
  let totalEnergy = 0

  const freqResolution = sampleRate / fftSize
  const harmonicTolerance = 0.05

  for (let i = 1; i < magnitudes.length; i++) {
    const freq = i * freqResolution
    const energy = magnitudes[i] * magnitudes[i]
    totalEnergy += energy

    for (let h = 1; h <= 10; h++) {
      const expectedFreq = fundamentalFreq * h
      if (Math.abs(freq - expectedFreq) / expectedFreq < harmonicTolerance) {
        harmonicEnergy += energy
        break
      }
    }
  }

  if (totalEnergy === 0) return 0.5

  const harmonicRatio = harmonicEnergy / totalEnergy
  return Math.max(0, Math.min(1, 1 - harmonicRatio))
}

function fftInPlace(real: Float32Array, imag: Float32Array): void {
  const n = real.length

  if (n <= 1) return

  let j = 0
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      ;[real[i], real[j]] = [real[j], real[i]]
      ;[imag[i], imag[j]] = [imag[j], imag[i]]
    }
    let k = n >> 1
    while (k <= j) {
      j -= k
      k >>= 1
    }
    j += k
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wReal = Math.cos(angle)
    const wImag = Math.sin(angle)

    for (let i = 0; i < n; i += len) {
      let curReal = 1
      let curImag = 0

      for (let k = 0; k < len / 2; k++) {
        const evenIdx = i + k
        const oddIdx = i + k + len / 2

        const tReal = curReal * real[oddIdx] - curImag * imag[oddIdx]
        const tImag = curReal * imag[oddIdx] + curImag * real[oddIdx]

        real[oddIdx] = real[evenIdx] - tReal
        imag[oddIdx] = imag[evenIdx] - tImag
        real[evenIdx] = real[evenIdx] + tReal
        imag[evenIdx] = imag[evenIdx] + tImag

        const newCurReal = curReal * wReal - curImag * wImag
        curImag = curReal * wImag + curImag * wReal
        curReal = newCurReal
      }
    }
  }
}

function calculateTransientSharpness(
  rmsEnvelope: number[],
  onsetIndex: number,
  peakIndex: number,
): number {
  if (peakIndex <= onsetIndex) return 0.5

  const onsetRms = rmsEnvelope[onsetIndex] ?? 0
  const peakRms = rmsEnvelope[peakIndex] ?? 0

  if (peakRms <= onsetRms) return 0.5

  const riseTime = peakIndex - onsetIndex
  const amplitudeRange = peakRms - onsetRms

  let maxSecondDerivative = 0
  for (let i = onsetIndex + 1; i < peakIndex - 1; i++) {
    const prev = rmsEnvelope[i - 1] ?? 0
    const curr = rmsEnvelope[i] ?? 0
    const next = rmsEnvelope[i + 1] ?? 0

    const secondDerivative = Math.abs(next - 2 * curr + prev)
    maxSecondDerivative = Math.max(maxSecondDerivative, secondDerivative)
  }

  const normalizedCurvature = amplitudeRange > 0 ? maxSecondDerivative / amplitudeRange : 0

  const quickRiseFactor = Math.exp(-riseTime / 10)
  const sharpness = quickRiseFactor * 0.5 + Math.min(normalizedCurvature * 5, 0.5)

  return Math.max(0, Math.min(1, sharpness))
}

export function analyzeAttackTransient(
  audioBuffer: Float32Array,
  sampleRate: number,
  fundamentalFreq: number,
): AttackFeatures {
  const attackWindowSamples = Math.floor((ATTACK_WINDOW_MS / 1000) * sampleRate)
  const rmsWindowSamples = Math.floor((RMS_WINDOW_MS / 1000) * sampleRate)
  const hopSize = Math.max(1, Math.floor(rmsWindowSamples / 2))

  const samplesToAnalyze = Math.min(audioBuffer.length, attackWindowSamples)

  const rmsEnvelope: number[] = []
  for (let i = 0; i < samplesToAnalyze - rmsWindowSamples; i += hopSize) {
    const rms = calculateRMS(audioBuffer, i, rmsWindowSamples)
    rmsEnvelope.push(rms)
  }

  if (rmsEnvelope.length < 3) {
    return {
      attackSlope: 20,
      timeToPeak: 15,
      noiseRatio: 0.2,
      transientSharpness: 0.5,
    }
  }

  const noiseFloor = calculateNoiseFloor(rmsEnvelope, Math.min(10, rmsEnvelope.length))
  const onsetIndex = findOnsetIndex(rmsEnvelope, noiseFloor)

  const maxSearchSamples = Math.floor((50 / 1000) * sampleRate)
  const maxSearchFrames = Math.floor(maxSearchSamples / hopSize)
  const peakIndex = findPeakIndex(rmsEnvelope, onsetIndex, onsetIndex + maxSearchFrames)

  const msPerFrame = (hopSize / sampleRate) * 1000
  const timeToPeak = (peakIndex - onsetIndex) * msPerFrame

  const onsetRmsDb = amplitudeToDb(rmsEnvelope[onsetIndex] ?? MIN_RMS_THRESHOLD)
  const peakRmsDb = amplitudeToDb(rmsEnvelope[peakIndex] ?? MIN_RMS_THRESHOLD)
  const attackSlope = timeToPeak > 0 ? (peakRmsDb - onsetRmsDb) / timeToPeak : 0

  const attackDurationSamples = Math.floor((30 / 1000) * sampleRate)
  const noiseRatio = estimateNoiseRatio(
    audioBuffer,
    sampleRate,
    fundamentalFreq,
    attackDurationSamples,
  )

  const transientSharpness = calculateTransientSharpness(rmsEnvelope, onsetIndex, peakIndex)

  return {
    attackSlope: Math.max(0, attackSlope),
    timeToPeak: Math.max(1, timeToPeak),
    noiseRatio: Math.max(0, Math.min(1, noiseRatio)),
    transientSharpness,
  }
}

export interface ExpectedAttackCharacteristics {
  attackSlopeRange: { min: number; max: number }
  timeToPeakRange: { min: number; max: number }
  noiseRatioRange: { min: number; max: number }
  sharpnessRange: { min: number; max: number }
}

export const STRING_ATTACK_CHARACTERISTICS: Record<number, ExpectedAttackCharacteristics> = {
  6: {
    attackSlopeRange: { min: 5, max: 15 },
    timeToPeakRange: { min: 15, max: 30 },
    noiseRatioRange: { min: 0.3, max: 0.5 },
    sharpnessRange: { min: 0.3, max: 0.5 },
  },
  5: {
    attackSlopeRange: { min: 10, max: 20 },
    timeToPeakRange: { min: 10, max: 25 },
    noiseRatioRange: { min: 0.2, max: 0.4 },
    sharpnessRange: { min: 0.4, max: 0.6 },
  },
  4: {
    attackSlopeRange: { min: 15, max: 25 },
    timeToPeakRange: { min: 8, max: 20 },
    noiseRatioRange: { min: 0.15, max: 0.3 },
    sharpnessRange: { min: 0.5, max: 0.7 },
  },
  3: {
    attackSlopeRange: { min: 15, max: 35 },
    timeToPeakRange: { min: 5, max: 20 },
    noiseRatioRange: { min: 0.1, max: 0.35 },
    sharpnessRange: { min: 0.5, max: 0.8 },
  },
  2: {
    attackSlopeRange: { min: 25, max: 40 },
    timeToPeakRange: { min: 5, max: 15 },
    noiseRatioRange: { min: 0.05, max: 0.2 },
    sharpnessRange: { min: 0.7, max: 0.85 },
  },
  1: {
    attackSlopeRange: { min: 30, max: 50 },
    timeToPeakRange: { min: 3, max: 10 },
    noiseRatioRange: { min: 0.02, max: 0.15 },
    sharpnessRange: { min: 0.8, max: 0.95 },
  },
}
