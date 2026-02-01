import { WINDOW_SIZE } from "@/hooks/useStringClassifier"
import FFT from "fft.js"
import { extractMfccSingle, mfcc as librosaMfcc } from "./mfcc"
import { spectralCentroid as librosaCentroid, spectralRolloff as librosaRolloff } from "./spectral"

export interface AudioFeatures {
  harmonicRatios: number[]
  spectralCentroid: number
  spectralRolloff: number
  inharmonicity: number
  rmsEnergy: number
  energySlope: number
  fundamental: number
  logFrequency: number
  semitonesFromE2: number
  octaveNumber: number
  mfcc: number[]
}

const N_HARMONICS = 12
const ROLLOFF_THRESHOLD = 0.85
const FRAME_LENGTH = 2048
const HOP_LENGTH = 512
const E2_FREQ = 82.41
const N_MFCC = 13

function parabolicInterpolation(f: Float32Array, x: number): number {
  if (x <= 0 || x >= f.length - 1) return x
  const denom = f[x - 1] - 2 * f[x] + f[x + 1]
  if (denom === 0) return x
  return (0.5 * (f[x - 1] - f[x + 1])) / denom + x
}

function autocorrelate(signal: Float32Array): Float32Array {
  const n = signal.length
  const corrLength = n
  const corr = new Float32Array(corrLength)

  for (let lag = 0; lag < corrLength; lag++) {
    let sum = 0
    for (let i = 0; i < n - lag; i++) {
      sum += signal[i] * signal[i + lag]
    }
    corr[lag] = sum
  }

  return corr
}

export function extractFundamental(
  samples: Float32Array,
  sampleRate: number,
): { pitch: number; clarity: number } {
  const signal = new Float32Array(samples.length)

  let mean = 0
  for (let i = 0; i < samples.length; i++) {
    mean += samples[i]
  }
  mean /= samples.length

  for (let i = 0; i < samples.length; i++) {
    signal[i] = samples[i] - mean
  }

  const corr = autocorrelate(signal)

  let start = 0
  for (let i = 1; i < corr.length - 1; i++) {
    if (corr[i] > corr[i - 1]) {
      start = i
      break
    }
  }

  if (start === 0) {
    return { pitch: 0, clarity: 0 }
  }

  const minLag = Math.floor(sampleRate / 1200)
  const maxLag = Math.floor(sampleRate / 50)
  const searchStart = Math.max(start, minLag)
  const searchEnd = Math.min(corr.length - 1, maxLag)

  let peakIndex = searchStart
  let peakValue = corr[searchStart]

  for (let i = searchStart + 1; i < searchEnd; i++) {
    if (corr[i] > peakValue) {
      peakValue = corr[i]
      peakIndex = i
    }
  }

  if (peakIndex <= 1 || peakIndex >= corr.length - 1) {
    return { pitch: 0, clarity: 0 }
  }

  const interpolatedPeak = parabolicInterpolation(corr, peakIndex)
  const pitch = sampleRate / interpolatedPeak
  const clarity = peakValue / corr[0]

  if (pitch < 50 || pitch > 1200) {
    return { pitch: 0, clarity: 0 }
  }

  return { pitch, clarity }
}

export function extractHarmonicRatios(
  samples: Float32Array,
  sampleRate: number,
  fundamental: number,
): number[] {
  if (fundamental <= 0) {
    return new Array(N_HARMONICS).fill(0)
  }

  const nFft = WINDOW_SIZE
  const fft = new FFT(nFft)

  const paddedSamples = new Float32Array(nFft)
  const copyLength = Math.min(samples.length, nFft)
  paddedSamples.set(samples.subarray(0, copyLength))

  const out = fft.createComplexArray()
  fft.realTransform(out, paddedSamples)

  const magnitudes = new Float32Array(nFft / 2 + 1) // +1 to match Python's rfft output size
  for (let i = 0; i <= nFft / 2; i++) {
    const re = out[2 * i]
    const im = out[2 * i + 1]
    magnitudes[i] = Math.sqrt(re * re + im * im)
  }

  const freqResolution = sampleRate / nFft
  const harmonicAmplitudes: number[] = []
  let fundamentalAmp = 0

  for (let h = 1; h <= N_HARMONICS; h++) {
    const targetFreq = fundamental * h
    const toleranceHz = fundamental * 0.05

    // Find bins within tolerance (matching Python's mask approach)
    let maxAmp = 0
    let foundWithinTolerance = false

    for (let bin = 0; bin < magnitudes.length; bin++) {
      const binFreq = bin * freqResolution
      if (Math.abs(binFreq - targetFreq) < toleranceHz) {
        foundWithinTolerance = true
        if (magnitudes[bin] > maxAmp) {
          maxAmp = magnitudes[bin]
        }
      }
    }

    // Fallback to nearest bin if no bins were within tolerance
    if (!foundWithinTolerance) {
      let nearestBin = 0
      let minDist = Infinity
      for (let bin = 0; bin < magnitudes.length; bin++) {
        const binFreq = bin * freqResolution
        const dist = Math.abs(binFreq - targetFreq)
        if (dist < minDist) {
          minDist = dist
          nearestBin = bin
        }
      }
      maxAmp = magnitudes[nearestBin]
    }

    if (h === 1) {
      fundamentalAmp = maxAmp
    }
    harmonicAmplitudes.push(maxAmp)
  }

  if (fundamentalAmp > 0) {
    return harmonicAmplitudes.map((amp) => amp / fundamentalAmp)
  }
  return harmonicAmplitudes
}

export function extractSpectralCentroid(samples: Float32Array, sampleRate: number): number {
  return librosaCentroid(samples, sampleRate, FRAME_LENGTH, HOP_LENGTH)
}

export function extractSpectralRolloff(samples: Float32Array, sampleRate: number): number {
  return librosaRolloff(samples, sampleRate, FRAME_LENGTH, HOP_LENGTH, ROLLOFF_THRESHOLD)
}

export function extractAttackTime(samples: Float32Array, sampleRate: number): number {
  const windowSize = Math.floor(sampleRate * 0.005)
  const hopLength = windowSize

  const numFrames = Math.floor(samples.length / hopLength)
  if (numFrames === 0) return 0

  const rms = new Float32Array(numFrames)

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopLength
    const end = Math.min(start + windowSize, samples.length)
    let sum = 0
    for (let i = start; i < end; i++) {
      sum += samples[i] * samples[i]
    }
    rms[frame] = Math.sqrt(sum / (end - start))
  }

  let maxAmp = 0
  for (let i = 0; i < rms.length; i++) {
    if (rms[i] > maxAmp) maxAmp = rms[i]
  }

  if (maxAmp === 0) return 0

  const threshold10 = 0.1 * maxAmp
  const threshold90 = 0.9 * maxAmp

  let start10Idx = 0
  let end90Idx = 0

  for (let i = 0; i < rms.length; i++) {
    if (rms[i] >= threshold10) {
      start10Idx = i
      break
    }
  }

  for (let i = start10Idx; i < rms.length; i++) {
    if (rms[i] >= threshold90) {
      end90Idx = i
      break
    }
  }

  const attackSamples = (end90Idx - start10Idx) * hopLength
  return attackSamples / sampleRate
}

export function extractRmsEnergy(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i]
  }
  return Math.sqrt(sum / samples.length)
}

export function extractEnergySlope(samples: Float32Array): number {
  const nSegments = 8
  const segmentLen = Math.floor(samples.length / nSegments)

  if (segmentLen === 0) return 0

  const energies: number[] = []
  for (let i = 0; i < nSegments; i++) {
    const start = i * segmentLen
    const end = start + segmentLen
    let sum = 0
    for (let j = start; j < end; j++) {
      sum += samples[j] * samples[j]
    }
    energies.push(Math.sqrt(sum / segmentLen))
  }

  const meanEnergy = energies.reduce((a, b) => a + b, 0) / nSegments
  if (meanEnergy < 1e-10) return 0

  const xMean = (nSegments - 1) / 2
  let num = 0
  let den = 0
  for (let i = 0; i < nSegments; i++) {
    num += (i - xMean) * energies[i]
    den += (i - xMean) * (i - xMean)
  }
  const slope = num / den

  return slope / meanEnergy
}

export function extractInharmonicity(
  samples: Float32Array,
  sampleRate: number,
  fundamental: number,
): number {
  if (fundamental <= 0) return 0

  const nFft = 8192
  const fft = new FFT(nFft)

  const paddedSamples = new Float32Array(nFft)
  const copyLength = Math.min(samples.length, nFft)
  paddedSamples.set(samples.subarray(0, copyLength))

  const out = fft.createComplexArray()
  fft.realTransform(out, paddedSamples)

  // Use nFft/2 + 1 to match numpy's rfftfreq output length
  const numBins = nFft / 2 + 1
  const magnitudes = new Float32Array(numBins)
  let meanMagnitude = 0

  for (let i = 0; i < numBins; i++) {
    const re = out[2 * i]
    const im = out[2 * i + 1]
    magnitudes[i] = Math.sqrt(re * re + im * im)
    meanMagnitude += magnitudes[i]
  }
  meanMagnitude /= magnitudes.length

  // Build frequency array to match numpy's rfftfreq
  const freqs = new Float32Array(numBins)
  for (let i = 0; i < numBins; i++) {
    freqs[i] = (i * sampleRate) / nFft
  }

  const deviations: number[] = []

  for (let h = 2; h <= Math.min(N_HARMONICS, 8); h++) {
    const idealFreq = fundamental * h
    const searchRange = fundamental * 0.15

    // Use strict inequalities to match Python's mask
    // mask = (freqs > ideal_freq - search_range) & (freqs < ideal_freq + search_range)
    const lowerBound = idealFreq - searchRange
    const upperBound = idealFreq + searchRange

    let peakIdx = -1
    let peakMag = -1

    for (let i = 0; i < numBins; i++) {
      if (freqs[i] > lowerBound && freqs[i] < upperBound) {
        if (magnitudes[i] > peakMag) {
          peakMag = magnitudes[i]
          peakIdx = i
        }
      }
    }

    // Check if any bins matched (equivalent to np.any(mask))
    if (peakIdx === -1) {
      continue
    }

    if (peakMag > meanMagnitude * 2) {
      const actualFreq = freqs[peakIdx]
      // Store signed deviation, take abs at the end like Python
      const deviation = (actualFreq - idealFreq) / idealFreq
      deviations.push(deviation)
    }
  }

  if (deviations.length === 0) return 0

  // Return mean of absolute deviations to match Python
  const absSum = deviations.reduce((a, b) => a + Math.abs(b), 0)
  return absSum / deviations.length
}

export function extractLogFrequency(fundamental: number): number {
  if (fundamental <= 0) return 0
  return Math.log2(fundamental)
}

export function extractSemitonesFromE2(fundamental: number): number {
  if (fundamental <= 0) return 0
  return 12.0 * Math.log2(fundamental / E2_FREQ)
}

export function extractOctaveNumber(fundamental: number): number {
  if (fundamental <= 0) return 0
  const octave = Math.floor(Math.log2(fundamental / E2_FREQ))
  return Math.max(0, Math.min(octave, 3))
}

// MFCC extraction using librosa-compatible implementation
export function extractMfccs(
  samples: Float32Array,
  sampleRate: number,
  nMfcc: number = N_MFCC,
): { mfccMean: number[]; mfccStd: number[] } {
  return librosaMfcc(samples, sampleRate, nMfcc)
}

export function extractMfcc(
  samples: Float32Array,
  sampleRate: number,
  nMfcc: number = N_MFCC,
): number[] {
  return extractMfccSingle(samples, sampleRate, nMfcc)
}

export function extractAllFeatures(samples: Float32Array, sampleRate: number): AudioFeatures {
  // const fundamental = freqFromAutocorr(samples, sampleRate)
  const { pitch: fundamental } = extractFundamental(samples, sampleRate)
  const mfcc = extractMfcc(samples, sampleRate)

  return {
    harmonicRatios: extractHarmonicRatios(samples, sampleRate, fundamental),
    spectralCentroid: extractSpectralCentroid(samples, sampleRate),
    spectralRolloff: extractSpectralRolloff(samples, sampleRate),
    inharmonicity: extractInharmonicity(samples, sampleRate, fundamental),
    rmsEnergy: extractRmsEnergy(samples),
    energySlope: extractEnergySlope(samples),
    fundamental,
    logFrequency: extractLogFrequency(fundamental),
    semitonesFromE2: extractSemitonesFromE2(fundamental),
    octaveNumber: extractOctaveNumber(fundamental),
    mfcc,
  }
}

export function featuresToVector(features: AudioFeatures): Float32Array {
  const vector = new Float32Array(33)

  for (let i = 0; i < 12; i++) {
    vector[i] = features.harmonicRatios[i] || 0
  }

  vector[12] = features.spectralCentroid
  vector[13] = features.spectralRolloff
  vector[14] = features.inharmonicity
  vector[15] = features.rmsEnergy
  vector[16] = features.energySlope

  vector[17] = features.logFrequency
  vector[18] = features.semitonesFromE2
  vector[19] = features.octaveNumber

  for (let i = 0; i < 13; i++) {
    vector[20 + i] = features.mfcc[i] || 0
  }

  return vector
}

export function normalizeFeatures(
  features: Float32Array,
  mean: number[],
  scale: number[],
): Float32Array {
  const normalized = new Float32Array(features.length)
  for (let i = 0; i < features.length; i++) {
    normalized[i] = (features[i] - mean[i]) / scale[i]
  }
  return normalized
}
