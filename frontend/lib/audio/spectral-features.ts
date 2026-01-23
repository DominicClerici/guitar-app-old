import FFT from "fft.js"

export type AudioBuffer = Float32Array<ArrayBufferLike>

export interface HarmonicRatios {
  h2h1: number
  h3h1: number
  evenOdd: number
}

export interface SpectralFeatures {
  centroid: number
  rolloff: number
  spread: number
  flatness: number
  flux: number
  zcr: number
  mfccs: number[]
  harmonicRatios: HarmonicRatios
}

interface MelFilterbankCache {
  sampleRate: number
  fftSize: number
  numFilters: number
  filterbank: Float32Array[]
}

interface DCTMatrixCache {
  numFilters: number
  numCoeffs: number
  matrix: Float32Array[]
}

let melFilterbankCache: MelFilterbankCache | null = null
let dctMatrixCache: DCTMatrixCache | null = null
let fftCache: Map<number, FFT> = new Map()

function getFFT(size: number): FFT {
  let fft = fftCache.get(size)
  if (!fft) {
    fft = new FFT(size)
    fftCache.set(size, fft)
  }
  return fft
}

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700)
}

function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1)
}

function createMelFilterbank(
  sampleRate: number,
  fftSize: number,
  numFilters: number,
  lowFreq = 20,
  highFreq?: number
): Float32Array[] {
  const nyquist = sampleRate / 2
  highFreq = highFreq ?? Math.min(nyquist, 8000)

  if (
    melFilterbankCache &&
    melFilterbankCache.sampleRate === sampleRate &&
    melFilterbankCache.fftSize === fftSize &&
    melFilterbankCache.numFilters === numFilters
  ) {
    return melFilterbankCache.filterbank
  }

  const numBins = fftSize / 2 + 1
  const lowMel = hzToMel(lowFreq)
  const highMel = hzToMel(highFreq)

  const melPoints = new Float32Array(numFilters + 2)
  for (let i = 0; i < numFilters + 2; i++) {
    melPoints[i] = lowMel + (i * (highMel - lowMel)) / (numFilters + 1)
  }

  const hzPoints = melPoints.map((mel) => melToHz(mel))

  const binPoints = hzPoints.map((hz) =>
    Math.floor(((fftSize + 1) * hz) / sampleRate)
  )

  const filterbank: Float32Array[] = []

  for (let m = 1; m <= numFilters; m++) {
    const filter = new Float32Array(numBins)
    const startBin = binPoints[m - 1]
    const centerBin = binPoints[m]
    const endBin = binPoints[m + 1]

    for (let k = startBin; k < centerBin; k++) {
      if (centerBin !== startBin) {
        filter[k] = (k - startBin) / (centerBin - startBin)
      }
    }

    for (let k = centerBin; k <= endBin; k++) {
      if (endBin !== centerBin) {
        filter[k] = (endBin - k) / (endBin - centerBin)
      }
    }

    filterbank.push(filter)
  }

  melFilterbankCache = { sampleRate, fftSize, numFilters, filterbank }
  return filterbank
}

/**
 * Creates a DCT-II matrix for MFCC computation.
 * DCT[i][j] = cos(PI * i * (j + 0.5) / N)
 */
function createDCTMatrix(numFilters: number, numCoeffs: number): Float32Array[] {
  if (
    dctMatrixCache &&
    dctMatrixCache.numFilters === numFilters &&
    dctMatrixCache.numCoeffs === numCoeffs
  ) {
    return dctMatrixCache.matrix
  }

  const matrix: Float32Array[] = []
  for (let i = 0; i < numCoeffs; i++) {
    const row = new Float32Array(numFilters)
    for (let j = 0; j < numFilters; j++) {
      row[j] = Math.cos((Math.PI * i * (j + 0.5)) / numFilters)
    }
    matrix.push(row)
  }

  dctMatrixCache = { numFilters, numCoeffs, matrix }
  return matrix
}

function applyHannWindow(buffer: Float32Array): Float32Array {
  const windowed = new Float32Array(buffer.length)
  for (let i = 0; i < buffer.length; i++) {
    const multiplier = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (buffer.length - 1)))
    windowed[i] = buffer[i] * multiplier
  }
  return windowed
}

function computePowerSpectrum(buffer: Float32Array, fftSize: number): Float32Array {
  const fft = getFFT(fftSize)
  const input = new Array(fftSize).fill(0)
  const output = fft.createComplexArray()

  for (let i = 0; i < Math.min(buffer.length, fftSize); i++) {
    input[i] = buffer[i]
  }

  fft.realTransform(output, input)

  const numBins = fftSize / 2 + 1
  const powerSpectrum = new Float32Array(numBins)

  for (let i = 0; i < numBins; i++) {
    const real = output[2 * i]
    const imag = output[2 * i + 1]
    powerSpectrum[i] = real * real + imag * imag
  }

  return powerSpectrum
}

function computeMagnitudeSpectrum(powerSpectrum: Float32Array): Float32Array {
  const magnitude = new Float32Array(powerSpectrum.length)
  for (let i = 0; i < powerSpectrum.length; i++) {
    magnitude[i] = Math.sqrt(powerSpectrum[i])
  }
  return magnitude
}

export function computeSpectralCentroid(
  magnitudeSpectrum: Float32Array,
  sampleRate: number,
  fftSize: number
): number {
  const binWidth = sampleRate / fftSize
  let weightedSum = 0
  let totalMagnitude = 0

  for (let i = 0; i < magnitudeSpectrum.length; i++) {
    const frequency = i * binWidth
    weightedSum += frequency * magnitudeSpectrum[i]
    totalMagnitude += magnitudeSpectrum[i]
  }

  if (totalMagnitude === 0) return 0
  return weightedSum / totalMagnitude
}

export function computeSpectralRolloff(
  magnitudeSpectrum: Float32Array,
  sampleRate: number,
  fftSize: number,
  rolloffPercent = 0.85
): number {
  const binWidth = sampleRate / fftSize
  let totalEnergy = 0

  for (let i = 0; i < magnitudeSpectrum.length; i++) {
    totalEnergy += magnitudeSpectrum[i]
  }

  const threshold = rolloffPercent * totalEnergy
  let cumulativeEnergy = 0

  for (let i = 0; i < magnitudeSpectrum.length; i++) {
    cumulativeEnergy += magnitudeSpectrum[i]
    if (cumulativeEnergy >= threshold) {
      return i * binWidth
    }
  }

  return (magnitudeSpectrum.length - 1) * binWidth
}

export function computeSpectralSpread(
  magnitudeSpectrum: Float32Array,
  sampleRate: number,
  fftSize: number,
  centroid?: number
): number {
  const binWidth = sampleRate / fftSize
  const computedCentroid =
    centroid ?? computeSpectralCentroid(magnitudeSpectrum, sampleRate, fftSize)

  let weightedVariance = 0
  let totalMagnitude = 0

  for (let i = 0; i < magnitudeSpectrum.length; i++) {
    const frequency = i * binWidth
    const deviation = frequency - computedCentroid
    weightedVariance += deviation * deviation * magnitudeSpectrum[i]
    totalMagnitude += magnitudeSpectrum[i]
  }

  if (totalMagnitude === 0) return 0
  return Math.sqrt(weightedVariance / totalMagnitude)
}

/**
 * Computes ratio of geometric mean to arithmetic mean.
 * Values near 0 indicate tonal content (peaked spectrum).
 * Values near 1 indicate noise-like content (flat spectrum).
 */
export function computeSpectralFlatness(magnitudeSpectrum: Float32Array): number {
  const n = magnitudeSpectrum.length
  if (n === 0) return 0

  let logSum = 0
  let arithmeticSum = 0
  let validCount = 0
  const epsilon = 1e-10

  for (let i = 0; i < n; i++) {
    const value = Math.max(magnitudeSpectrum[i], epsilon)
    logSum += Math.log(value)
    arithmeticSum += magnitudeSpectrum[i]
    validCount++
  }

  if (validCount === 0 || arithmeticSum === 0) return 0

  const geometricMean = Math.exp(logSum / validCount)
  const arithmeticMean = arithmeticSum / validCount

  return geometricMean / arithmeticMean
}

export function computeSpectralFlux(
  currentSpectrum: Float32Array,
  previousSpectrum: Float32Array | undefined
): number {
  if (!previousSpectrum || currentSpectrum.length !== previousSpectrum.length) {
    return 0
  }

  let flux = 0
  for (let i = 0; i < currentSpectrum.length; i++) {
    const diff = currentSpectrum[i] - previousSpectrum[i]
    flux += diff * diff
  }

  return Math.sqrt(flux)
}

export function computeZeroCrossingRate(audioBuffer: Float32Array): number {
  if (audioBuffer.length < 2) return 0

  let crossings = 0
  for (let i = 1; i < audioBuffer.length; i++) {
    if (
      (audioBuffer[i] >= 0 && audioBuffer[i - 1] < 0) ||
      (audioBuffer[i] < 0 && audioBuffer[i - 1] >= 0)
    ) {
      crossings++
    }
  }

  return crossings / (audioBuffer.length - 1)
}

export function computeMFCCs(
  powerSpectrum: Float32Array,
  sampleRate: number,
  fftSize: number,
  numCoeffs = 13,
  numFilters = 26
): number[] {
  const filterbank = createMelFilterbank(sampleRate, fftSize, numFilters)
  const dctMatrix = createDCTMatrix(numFilters, numCoeffs)

  const filterEnergies = new Float32Array(numFilters)
  for (let m = 0; m < numFilters; m++) {
    let energy = 0
    const filter = filterbank[m]
    for (let k = 0; k < powerSpectrum.length; k++) {
      energy += powerSpectrum[k] * filter[k]
    }
    filterEnergies[m] = Math.log(Math.max(energy, 1e-10))
  }

  const mfccs: number[] = []
  for (let i = 1; i < numCoeffs; i++) {
    let coeff = 0
    const row = dctMatrix[i]
    for (let j = 0; j < numFilters; j++) {
      coeff += filterEnergies[j] * row[j]
    }
    mfccs.push(coeff)
  }

  return mfccs
}

function findPeakAmplitude(
  magnitudeSpectrum: Float32Array,
  targetFreq: number,
  sampleRate: number,
  fftSize: number,
  searchWidthHz = 20
): number {
  const binWidth = sampleRate / fftSize
  const targetBin = Math.round(targetFreq / binWidth)
  const searchBins = Math.ceil(searchWidthHz / binWidth)

  const startBin = Math.max(0, targetBin - searchBins)
  const endBin = Math.min(magnitudeSpectrum.length - 1, targetBin + searchBins)

  let maxAmplitude = 0
  for (let i = startBin; i <= endBin; i++) {
    if (magnitudeSpectrum[i] > maxAmplitude) {
      maxAmplitude = magnitudeSpectrum[i]
    }
  }

  return maxAmplitude
}

export function computeHarmonicRatios(
  magnitudeSpectrum: Float32Array,
  fundamentalFreq: number,
  sampleRate: number,
  fftSize: number
): HarmonicRatios {
  if (fundamentalFreq <= 0) {
    return { h2h1: 0, h3h1: 0, evenOdd: 0 }
  }

  const h1 = findPeakAmplitude(
    magnitudeSpectrum,
    fundamentalFreq,
    sampleRate,
    fftSize
  )
  const h2 = findPeakAmplitude(
    magnitudeSpectrum,
    fundamentalFreq * 2,
    sampleRate,
    fftSize
  )
  const h3 = findPeakAmplitude(
    magnitudeSpectrum,
    fundamentalFreq * 3,
    sampleRate,
    fftSize
  )
  const h4 = findPeakAmplitude(
    magnitudeSpectrum,
    fundamentalFreq * 4,
    sampleRate,
    fftSize
  )
  const h5 = findPeakAmplitude(
    magnitudeSpectrum,
    fundamentalFreq * 5,
    sampleRate,
    fftSize
  )
  const h6 = findPeakAmplitude(
    magnitudeSpectrum,
    fundamentalFreq * 6,
    sampleRate,
    fftSize
  )

  const epsilon = 1e-10

  const h2h1 = h1 > epsilon ? h2 / h1 : 0
  const h3h1 = h1 > epsilon ? h3 / h1 : 0

  const evenSum = h2 + h4 + h6
  const oddSum = h1 + h3 + h5
  const evenOdd = oddSum > epsilon ? evenSum / oddSum : 0

  return { h2h1, h3h1, evenOdd }
}

export function extractFeatures(
  audioBuffer: AudioBuffer,
  sampleRate: number,
  fundamentalFreq?: number,
  previousSpectrum?: AudioBuffer
): SpectralFeatures {
  const fftSize = nextPowerOfTwo(audioBuffer.length)

  const windowed = applyHannWindow(audioBuffer)
  const powerSpectrum = computePowerSpectrum(windowed, fftSize)
  const magnitudeSpectrum = computeMagnitudeSpectrum(powerSpectrum)

  const centroid = computeSpectralCentroid(magnitudeSpectrum, sampleRate, fftSize)
  const rolloff = computeSpectralRolloff(magnitudeSpectrum, sampleRate, fftSize)
  const spread = computeSpectralSpread(
    magnitudeSpectrum,
    sampleRate,
    fftSize,
    centroid
  )
  const flatness = computeSpectralFlatness(magnitudeSpectrum)
  const flux = computeSpectralFlux(magnitudeSpectrum, previousSpectrum)
  const zcr = computeZeroCrossingRate(audioBuffer)
  const mfccs = computeMFCCs(powerSpectrum, sampleRate, fftSize)

  const harmonicRatios = fundamentalFreq
    ? computeHarmonicRatios(magnitudeSpectrum, fundamentalFreq, sampleRate, fftSize)
    : { h2h1: 0, h3h1: 0, evenOdd: 0 }

  return {
    centroid,
    rolloff,
    spread,
    flatness,
    flux,
    zcr,
    mfccs,
    harmonicRatios,
  }
}

export function extractFeaturesWithSpectrum(
  audioBuffer: AudioBuffer,
  sampleRate: number,
  fundamentalFreq?: number,
  previousSpectrum?: AudioBuffer
): { features: SpectralFeatures; magnitudeSpectrum: AudioBuffer } {
  const fftSize = nextPowerOfTwo(audioBuffer.length)

  const windowed = applyHannWindow(audioBuffer)
  const powerSpectrum = computePowerSpectrum(windowed, fftSize)
  const magnitudeSpectrum = computeMagnitudeSpectrum(powerSpectrum)

  const centroid = computeSpectralCentroid(magnitudeSpectrum, sampleRate, fftSize)
  const rolloff = computeSpectralRolloff(magnitudeSpectrum, sampleRate, fftSize)
  const spread = computeSpectralSpread(
    magnitudeSpectrum,
    sampleRate,
    fftSize,
    centroid
  )
  const flatness = computeSpectralFlatness(magnitudeSpectrum)
  const flux = computeSpectralFlux(magnitudeSpectrum, previousSpectrum)
  const zcr = computeZeroCrossingRate(audioBuffer)
  const mfccs = computeMFCCs(powerSpectrum, sampleRate, fftSize)

  const harmonicRatios = fundamentalFreq
    ? computeHarmonicRatios(magnitudeSpectrum, fundamentalFreq, sampleRate, fftSize)
    : { h2h1: 0, h3h1: 0, evenOdd: 0 }

  return {
    features: {
      centroid,
      rolloff,
      spread,
      flatness,
      flux,
      zcr,
      mfccs,
      harmonicRatios,
    },
    magnitudeSpectrum,
  }
}

export function featuresToVector(features: SpectralFeatures): number[] {
  return [
    features.centroid,
    features.rolloff,
    features.spread,
    features.flatness,
    features.flux,
    features.zcr,
    ...features.mfccs,
    features.harmonicRatios.h2h1,
    features.harmonicRatios.h3h1,
    features.harmonicRatios.evenOdd,
  ]
}

export function normalizeFeatureVector(
  vector: number[],
  means: number[],
  stds: number[]
): number[] {
  return vector.map((value, i) => {
    const std = stds[i] || 1
    return (value - (means[i] || 0)) / std
  })
}

function nextPowerOfTwo(n: number): number {
  let power = 1
  while (power < n) {
    power *= 2
  }
  return power
}

export function clearCaches(): void {
  melFilterbankCache = null
  dctMatrixCache = null
  fftCache.clear()
}
