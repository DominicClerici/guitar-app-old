"use client"

import FFT from "fft.js"

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
  fftSize: number,
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
  searchRangeCents: number = 100,
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
  harmonicNumber: number,
): number {
  const idealFreq = harmonicNumber * fundamental
  const ratio = actualFreq / idealFreq
  const ratioSquared = ratio * ratio
  const b = (ratioSquared - 1) / (harmonicNumber * harmonicNumber)
  return Math.max(0, b)
}

export function calculateSpectralCentroid(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
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
