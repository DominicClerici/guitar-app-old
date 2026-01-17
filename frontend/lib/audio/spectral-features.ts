"use client"

import {
  applyHannWindow,
  computeFFTMagnitudes,
  findPeakNearFrequency,
  parabolicInterpolation,
} from "./fft-utils"

export interface SpectralFeatures {
  spectralCentroid: number
  spectralRolloff: number
  spectralSpread: number
  spectralFlatness: number
  spectralFlux: number
  zeroCrossingRate: number
  mfccs: number[]
  harmonicRatios: {
    h2h1: number
    h3h1: number
    evenOddRatio: number
  }
  inharmonicity: number
}

export interface FeatureExtractionConfig {
  sampleRate: number
  fftSize: number
  numMfccs: number
  numMelFilters: number
  minFreq: number
  maxFreq: number
}

const DEFAULT_CONFIG: FeatureExtractionConfig = {
  sampleRate: 44100,
  fftSize: 4096,
  numMfccs: 13,
  numMelFilters: 26,
  minFreq: 60,
  maxFreq: 8000,
}

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700)
}

function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1)
}

let melFilterbankCache: Map<string, Float32Array[]> = new Map()

function createMelFilterbank(config: FeatureExtractionConfig): Float32Array[] {
  const cacheKey = `${config.sampleRate}-${config.fftSize}-${config.numMelFilters}-${config.minFreq}-${config.maxFreq}`
  if (melFilterbankCache.has(cacheKey)) {
    return melFilterbankCache.get(cacheKey)!
  }

  const numBins = config.fftSize / 2
  const binResolution = config.sampleRate / config.fftSize

  const minMel = hzToMel(config.minFreq)
  const maxMel = hzToMel(config.maxFreq)

  const melPoints: number[] = []
  for (let i = 0; i <= config.numMelFilters + 1; i++) {
    const mel = minMel + (i * (maxMel - minMel)) / (config.numMelFilters + 1)
    melPoints.push(melToHz(mel))
  }

  const binPoints = melPoints.map((hz) => Math.floor(hz / binResolution))

  const filterbank: Float32Array[] = []
  for (let m = 1; m <= config.numMelFilters; m++) {
    const filter = new Float32Array(numBins)
    const left = binPoints[m - 1]
    const center = binPoints[m]
    const right = binPoints[m + 1]

    for (let k = left; k < center && k < numBins; k++) {
      if (center !== left) {
        filter[k] = (k - left) / (center - left)
      }
    }
    for (let k = center; k <= right && k < numBins; k++) {
      if (right !== center) {
        filter[k] = (right - k) / (right - center)
      }
    }
    filterbank.push(filter)
  }

  melFilterbankCache.set(cacheKey, filterbank)
  return filterbank
}

let dctMatrixCache: Map<string, Float32Array[]> = new Map()

function createDCTMatrix(numMfccs: number, numFilters: number): Float32Array[] {
  const cacheKey = `${numMfccs}-${numFilters}`
  if (dctMatrixCache.has(cacheKey)) {
    return dctMatrixCache.get(cacheKey)!
  }

  const matrix: Float32Array[] = []
  for (let k = 0; k < numMfccs; k++) {
    const row = new Float32Array(numFilters)
    for (let n = 0; n < numFilters; n++) {
      row[n] = Math.cos((Math.PI * k * (n + 0.5)) / numFilters)
    }
    matrix.push(row)
  }

  dctMatrixCache.set(cacheKey, matrix)
  return matrix
}

export function computeMFCCs(
  magnitudes: Float32Array,
  config: FeatureExtractionConfig = DEFAULT_CONFIG,
): number[] {
  const filterbank = createMelFilterbank(config)
  const dctMatrix = createDCTMatrix(config.numMfccs, config.numMelFilters)

  const filterEnergies = new Float32Array(config.numMelFilters)
  for (let m = 0; m < config.numMelFilters; m++) {
    let energy = 0
    for (let k = 0; k < magnitudes.length && k < filterbank[m].length; k++) {
      energy += filterbank[m][k] * magnitudes[k] * magnitudes[k]
    }
    filterEnergies[m] = Math.log(Math.max(energy, 1e-10))
  }

  const mfccs: number[] = []
  for (let k = 1; k < config.numMfccs; k++) {
    let sum = 0
    for (let n = 0; n < config.numMelFilters; n++) {
      sum += dctMatrix[k][n] * filterEnergies[n]
    }
    mfccs.push(sum)
  }

  return mfccs
}

export function computeSpectralCentroid(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
): number {
  const binResolution = sampleRate / fftSize
  let weightedSum = 0
  let totalMagnitude = 0

  for (let i = 1; i < magnitudes.length; i++) {
    const freq = i * binResolution
    weightedSum += freq * magnitudes[i]
    totalMagnitude += magnitudes[i]
  }

  return totalMagnitude > 0 ? weightedSum / totalMagnitude : 0
}

export function computeSpectralRolloff(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  threshold: number = 0.85,
): number {
  const binResolution = sampleRate / fftSize
  let totalEnergy = 0

  for (let i = 0; i < magnitudes.length; i++) {
    totalEnergy += magnitudes[i] * magnitudes[i]
  }

  const targetEnergy = totalEnergy * threshold
  let cumulativeEnergy = 0

  for (let i = 0; i < magnitudes.length; i++) {
    cumulativeEnergy += magnitudes[i] * magnitudes[i]
    if (cumulativeEnergy >= targetEnergy) {
      return i * binResolution
    }
  }

  return (magnitudes.length - 1) * binResolution
}

export function computeSpectralSpread(
  magnitudes: Float32Array,
  centroid: number,
  sampleRate: number,
  fftSize: number,
): number {
  const binResolution = sampleRate / fftSize
  let weightedVariance = 0
  let totalMagnitude = 0

  for (let i = 1; i < magnitudes.length; i++) {
    const freq = i * binResolution
    const diff = freq - centroid
    weightedVariance += diff * diff * magnitudes[i]
    totalMagnitude += magnitudes[i]
  }

  return totalMagnitude > 0 ? Math.sqrt(weightedVariance / totalMagnitude) : 0
}

export function computeSpectralFlatness(magnitudes: Float32Array): number {
  const n = magnitudes.length
  let logSum = 0
  let arithmeticSum = 0
  let validCount = 0

  for (let i = 1; i < n; i++) {
    if (magnitudes[i] > 1e-10) {
      logSum += Math.log(magnitudes[i])
      arithmeticSum += magnitudes[i]
      validCount++
    }
  }

  if (validCount === 0 || arithmeticSum === 0) return 0

  const geometricMean = Math.exp(logSum / validCount)
  const arithmeticMean = arithmeticSum / validCount

  return geometricMean / arithmeticMean
}

let previousMagnitudes: Float32Array | null = null

export function computeSpectralFlux(
  magnitudes: Float32Array,
  previousMags: Float32Array | null = null,
): number {
  const prev = previousMags ?? previousMagnitudes
  previousMagnitudes = new Float32Array(magnitudes)

  if (!prev || prev.length !== magnitudes.length) {
    return 0
  }

  let flux = 0
  for (let i = 0; i < magnitudes.length; i++) {
    const diff = magnitudes[i] - prev[i]
    flux += diff * diff
  }

  return Math.sqrt(flux / magnitudes.length)
}

export function computeZeroCrossingRate(timeDomainData: Float32Array): number {
  let crossings = 0
  for (let i = 1; i < timeDomainData.length; i++) {
    if (
      (timeDomainData[i] >= 0 && timeDomainData[i - 1] < 0) ||
      (timeDomainData[i] < 0 && timeDomainData[i - 1] >= 0)
    ) {
      crossings++
    }
  }
  return crossings / timeDomainData.length
}

export function computeHarmonicRatios(
  magnitudes: Float32Array,
  fundamental: number,
  sampleRate: number,
  fftSize: number,
): { h2h1: number; h3h1: number; evenOddRatio: number } {
  const binResolution = sampleRate / fftSize

  const findPeakAmplitude = (targetFreq: number): number => {
    const targetBin = Math.round(targetFreq / binResolution)
    const searchRange = 3

    let maxAmp = 0
    for (
      let i = Math.max(0, targetBin - searchRange);
      i <= Math.min(magnitudes.length - 1, targetBin + searchRange);
      i++
    ) {
      if (magnitudes[i] > maxAmp) {
        maxAmp = magnitudes[i]
      }
    }
    return maxAmp
  }

  const h1 = findPeakAmplitude(fundamental)
  const h2 = findPeakAmplitude(fundamental * 2)
  const h3 = findPeakAmplitude(fundamental * 3)
  const h4 = findPeakAmplitude(fundamental * 4)
  const h5 = findPeakAmplitude(fundamental * 5)
  const h6 = findPeakAmplitude(fundamental * 6)

  const h2h1 = h1 > 0 ? h2 / h1 : 0
  const h3h1 = h1 > 0 ? h3 / h1 : 0

  const evenSum = h2 + h4 + h6
  const oddSum = h1 + h3 + h5
  const evenOddRatio = oddSum > 0 ? evenSum / oddSum : 0

  return { h2h1, h3h1, evenOddRatio }
}

export function measureInharmonicity(
  magnitudes: Float32Array,
  fundamentalFreq: number,
  sampleRate: number,
  fftSize: number,
): number {
  if (fundamentalFreq <= 0) return 0

  const harmonicsToMeasure = [2, 3, 4, 5]
  const bEstimates: number[] = []

  const fundamentalPeak = findPeakNearFrequency(
    magnitudes,
    fundamentalFreq,
    sampleRate,
    fftSize,
    50,
  )
  if (!fundamentalPeak || fundamentalPeak.amplitude < 1e-6) return 0

  for (const n of harmonicsToMeasure) {
    const expectedFreq = n * fundamentalFreq

    if (expectedFreq > sampleRate / 2 - 100) break

    const peak = findPeakNearFrequency(magnitudes, expectedFreq, sampleRate, fftSize, 80)
    if (!peak) continue

    const relativeAmplitude = peak.amplitude / fundamentalPeak.amplitude
    if (relativeAmplitude < 0.01) continue

    const interpolated = parabolicInterpolation(magnitudes, peak.peakIndex, sampleRate, fftSize)
    const actualFreq = interpolated.frequency

    const idealFreq = n * fundamentalFreq
    const ratio = actualFreq / idealFreq
    const ratioSquared = ratio * ratio
    const b = (ratioSquared - 1) / (n * n)

    if (b >= 0 && b < 0.001) {
      bEstimates.push(b)
    }
  }

  if (bEstimates.length === 0) return 0

  bEstimates.sort((a, b) => a - b)
  const median = bEstimates[Math.floor(bEstimates.length / 2)]
  return median
}

export function extractSpectralFeatures(
  timeDomainData: Float32Array,
  fundamental: number | null,
  config: Partial<FeatureExtractionConfig> = {},
  previousMags: Float32Array | null = null,
): SpectralFeatures {
  const fullConfig: FeatureExtractionConfig = { ...DEFAULT_CONFIG, ...config }

  const windowed = applyHannWindow(timeDomainData)
  const magnitudes = computeFFTMagnitudes(windowed)

  const spectralCentroid = computeSpectralCentroid(
    magnitudes,
    fullConfig.sampleRate,
    fullConfig.fftSize,
  )
  const spectralRolloff = computeSpectralRolloff(
    magnitudes,
    fullConfig.sampleRate,
    fullConfig.fftSize,
  )
  const spectralSpread = computeSpectralSpread(
    magnitudes,
    spectralCentroid,
    fullConfig.sampleRate,
    fullConfig.fftSize,
  )
  const spectralFlatness = computeSpectralFlatness(magnitudes)
  const spectralFlux = computeSpectralFlux(magnitudes, previousMags)
  const zeroCrossingRate = computeZeroCrossingRate(timeDomainData)
  const mfccs = computeMFCCs(magnitudes, fullConfig)

  const harmonicRatios =
    fundamental && fundamental > 0
      ? computeHarmonicRatios(magnitudes, fundamental, fullConfig.sampleRate, fullConfig.fftSize)
      : { h2h1: 0, h3h1: 0, evenOddRatio: 0 }

  const inharmonicity =
    fundamental && fundamental > 0
      ? measureInharmonicity(magnitudes, fundamental, fullConfig.sampleRate, fullConfig.fftSize)
      : 0

  return {
    spectralCentroid,
    spectralRolloff,
    spectralSpread,
    spectralFlatness,
    spectralFlux,
    zeroCrossingRate,
    mfccs,
    harmonicRatios,
    inharmonicity,
  }
}

export function featuresToVector(features: SpectralFeatures): number[] {
  return [
    features.spectralCentroid,
    features.spectralRolloff,
    features.spectralSpread,
    features.spectralFlatness,
    features.spectralFlux,
    features.zeroCrossingRate,
    ...features.mfccs,
    features.harmonicRatios.h2h1,
    features.harmonicRatios.h3h1,
    features.harmonicRatios.evenOddRatio,
  ]
}

export function featuresToVectorWithInharmonicity(features: SpectralFeatures): number[] {
  return [...featuresToVector(features), features.inharmonicity]
}

export function vectorToFeatures(vector: number[]): SpectralFeatures {
  const numMfccs = vector.length - 9
  return {
    spectralCentroid: vector[0],
    spectralRolloff: vector[1],
    spectralSpread: vector[2],
    spectralFlatness: vector[3],
    spectralFlux: vector[4],
    zeroCrossingRate: vector[5],
    mfccs: vector.slice(6, 6 + numMfccs),
    harmonicRatios: {
      h2h1: vector[6 + numMfccs],
      h3h1: vector[7 + numMfccs],
      evenOddRatio: vector[8 + numMfccs],
    },
    inharmonicity: 0,
  }
}

export interface MultiWindowConfig {
  attackWindowMs: [number, number]
  sustainWindowMs: [number, number]
  decayWindowMs: [number, number]
}

const DEFAULT_MULTI_WINDOW_CONFIG: MultiWindowConfig = {
  attackWindowMs: [0, 30],
  sustainWindowMs: [50, 150],
  decayWindowMs: [200, 300],
}

export function extractMultiWindowFeatures(
  audioData: Float32Array,
  pitch: number,
  sampleRate: number,
  fftSize: number,
  windowConfig: MultiWindowConfig = DEFAULT_MULTI_WINDOW_CONFIG,
): number[] {
  const featureConfig: Partial<FeatureExtractionConfig> = { sampleRate, fftSize }

  const extractWindowChunk = (startMs: number, endMs: number): Float32Array => {
    const startSample = Math.floor((startMs / 1000) * sampleRate)
    const endSample = Math.floor((endMs / 1000) * sampleRate)
    const windowCenter = Math.floor((startSample + endSample) / 2)
    const halfFft = Math.floor(fftSize / 2)

    let chunkStart = windowCenter - halfFft
    let chunkEnd = windowCenter + halfFft

    if (chunkStart < 0) {
      chunkStart = 0
      chunkEnd = fftSize
    }
    if (chunkEnd > audioData.length) {
      chunkEnd = audioData.length
      chunkStart = Math.max(0, chunkEnd - fftSize)
    }

    const chunk = audioData.slice(chunkStart, chunkEnd)

    if (chunk.length < fftSize) {
      const padded = new Float32Array(fftSize)
      padded.set(chunk)
      return padded
    }

    return chunk
  }

  const extractWindowFeatures = (chunk: Float32Array): number[] => {
    const features = extractSpectralFeatures(chunk, pitch, featureConfig)
    return featuresToVector(features)
  }

  const attackChunk = extractWindowChunk(
    windowConfig.attackWindowMs[0],
    windowConfig.attackWindowMs[1],
  )
  const sustainChunk = extractWindowChunk(
    windowConfig.sustainWindowMs[0],
    windowConfig.sustainWindowMs[1],
  )
  const decayChunk = extractWindowChunk(
    windowConfig.decayWindowMs[0],
    windowConfig.decayWindowMs[1],
  )

  const attackFeatures = extractWindowFeatures(attackChunk)
  const sustainFeatures = extractWindowFeatures(sustainChunk)
  const decayFeatures = extractWindowFeatures(decayChunk)

  const sustainWindowed = applyHannWindow(sustainChunk)
  const sustainMagnitudes = computeFFTMagnitudes(sustainWindowed)
  const inharmonicity = measureInharmonicity(sustainMagnitudes, pitch, sampleRate, fftSize)

  return [...attackFeatures, ...sustainFeatures, ...decayFeatures, inharmonicity]
}
