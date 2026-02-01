/**
 * Spectral feature extraction - librosa-compatible implementation
 *
 * This module provides exact TypeScript clones of librosa's spectral_centroid
 * and spectral_rolloff functions to ensure feature extraction consistency
 * between Python training and browser inference.
 */

import FFT from "fft.js"

/**
 * Compute FFT bin center frequencies (matches librosa.fft_frequencies)
 *
 * Returns frequencies: [0, sr/n_fft, 2*sr/n_fft, ..., sr/2]
 * Array length: n_fft/2 + 1
 */
export function fftFrequencies(sampleRate: number, nFft: number): Float32Array {
  const numBins = Math.floor(nFft / 2) + 1
  const freqs = new Float32Array(numBins)
  for (let i = 0; i < numBins; i++) {
    freqs[i] = (i * sampleRate) / nFft
  }
  return freqs
}

/**
 * Create a Hann window of given length (matches scipy.signal.windows.hann with fftbins=True)
 */
function hannWindow(length: number): Float32Array {
  const window = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    // librosa uses fftbins=True which is: 0.5 - 0.5 * cos(2*pi*i/length)
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / length))
  }
  return window
}

/**
 * Compute Short-Time Fourier Transform magnitude spectrogram
 * Matches librosa.stft behavior with center=True, pad_mode='constant'
 *
 * @param samples - Audio samples
 * @param sampleRate - Sample rate (not used in computation but kept for API consistency)
 * @param nFft - FFT window size (default 2048)
 * @param hopLength - Hop length between frames (default 512)
 * @param winLength - Window length (default nFft)
 * @param power - Exponent for magnitude (1=magnitude, 2=power, default 1)
 * @returns Magnitude spectrogram [numBins x numFrames] flattened as Float32Array
 *          along with shape information
 */
export function stftMagnitude(
  samples: Float32Array,
  nFft: number = 2048,
  hopLength: number = 512,
  winLength: number | null = null,
  power: number = 1,
): { magnitudes: Float32Array; numBins: number; numFrames: number } {
  if (winLength === null) {
    winLength = nFft
  }

  // Create window and pad it to n_fft (librosa pads window symmetrically)
  const window = hannWindow(winLength)
  const paddedWindow = new Float32Array(nFft)
  const padStart = Math.floor((nFft - winLength) / 2)
  for (let i = 0; i < winLength; i++) {
    paddedWindow[padStart + i] = window[i]
  }

  // Pad the signal for centered STFT (librosa center=True)
  const padLength = Math.floor(nFft / 2)
  const paddedLength = samples.length + 2 * padLength
  const paddedSamples = new Float32Array(paddedLength)
  // Zero padding on both sides (pad_mode='constant' with default 0)
  for (let i = 0; i < samples.length; i++) {
    paddedSamples[padLength + i] = samples[i]
  }

  // Calculate number of frames (matching librosa's frame calculation)
  const numFrames = 1 + Math.floor((paddedLength - nFft) / hopLength)
  const numBins = Math.floor(nFft / 2) + 1

  // Allocate output: shape is [numBins, numFrames]
  const magnitudes = new Float32Array(numBins * numFrames)

  // Create FFT instance
  const fft = new FFT(nFft)
  const frameBuffer = new Float32Array(nFft)
  const fftOut = fft.createComplexArray()

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopLength

    // Extract frame and apply window
    for (let i = 0; i < nFft; i++) {
      frameBuffer[i] = paddedSamples[start + i] * paddedWindow[i]
    }

    // Compute FFT
    fft.realTransform(fftOut, frameBuffer)

    // Extract magnitudes for positive frequencies (0 to Nyquist)
    for (let bin = 0; bin < numBins; bin++) {
      const re = fftOut[2 * bin]
      const im = fftOut[2 * bin + 1]
      let mag = Math.sqrt(re * re + im * im)

      // Apply power exponent
      if (power !== 1) {
        mag = Math.pow(mag, power)
      }

      magnitudes[bin * numFrames + frame] = mag
    }
  }

  return { magnitudes, numBins, numFrames }
}

/**
 * Compute spectral centroid - exact match of librosa.feature.spectral_centroid
 *
 * The spectral centroid is the "center of mass" of the spectrum.
 * Each frame is normalized (L1) and treated as a distribution over frequency bins.
 *
 * Formula: centroid[t] = sum_k(S[k,t] * freq[k]) / sum_j(S[j,t])
 *
 * @param samples - Audio samples (Float32Array)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT window size (default 2048)
 * @param hopLength - Hop length (default 512)
 * @returns Mean spectral centroid in Hz
 */
export function spectralCentroid(
  samples: Float32Array,
  sampleRate: number,
  nFft: number = 2048,
  hopLength: number = 512,
): number {
  // Compute magnitude spectrogram (power=1 for magnitude, not squared)
  const { magnitudes, numBins, numFrames } = stftMagnitude(samples, nFft, hopLength, null, 1)

  // Get frequency array
  const freqs = fftFrequencies(sampleRate, nFft)

  let totalCentroid = 0
  let validFrames = 0

  for (let frame = 0; frame < numFrames; frame++) {
    // Compute L1 norm (sum of magnitudes) for this frame
    let sumMag = 0
    for (let bin = 0; bin < numBins; bin++) {
      sumMag += magnitudes[bin * numFrames + frame]
    }

    // Skip frames with zero energy (avoid division by zero)
    if (sumMag < 1e-10) {
      continue
    }

    // Compute weighted sum: sum(freq * mag / sumMag)
    let centroid = 0
    for (let bin = 0; bin < numBins; bin++) {
      const normalizedMag = magnitudes[bin * numFrames + frame] / sumMag
      centroid += freqs[bin] * normalizedMag
    }

    totalCentroid += centroid
    validFrames++
  }

  return validFrames > 0 ? totalCentroid / validFrames : 0
}

/**
 * Compute spectral rolloff - exact match of librosa.feature.spectral_rolloff
 *
 * The rolloff frequency is the frequency below which a specified percentage
 * (default 85%) of the total spectral energy is contained.
 *
 * @param samples - Audio samples (Float32Array)
 * @param sampleRate - Sample rate in Hz
 * @param nFft - FFT window size (default 2048)
 * @param hopLength - Hop length (default 512)
 * @param rollPercent - Fraction of energy for rolloff (default 0.85)
 * @returns Mean spectral rolloff frequency in Hz
 */
export function spectralRolloff(
  samples: Float32Array,
  sampleRate: number,
  nFft: number = 2048,
  hopLength: number = 512,
  rollPercent: number = 0.85,
): number {
  // Compute magnitude spectrogram (power=1 for magnitude)
  const { magnitudes, numBins, numFrames } = stftMagnitude(samples, nFft, hopLength, null, 1)

  // Get frequency array
  const freqs = fftFrequencies(sampleRate, nFft)

  let totalRolloff = 0
  let validFrames = 0

  for (let frame = 0; frame < numFrames; frame++) {
    // Compute total energy for this frame
    let totalEnergy = 0
    for (let bin = 0; bin < numBins; bin++) {
      totalEnergy += magnitudes[bin * numFrames + frame]
    }

    // Skip frames with zero energy
    if (totalEnergy < 1e-10) {
      continue
    }

    // Find rolloff frequency using cumulative sum
    const threshold = rollPercent * totalEnergy
    let cumulativeEnergy = 0
    let rolloffFreq = freqs[numBins - 1] // Default to Nyquist

    for (let bin = 0; bin < numBins; bin++) {
      cumulativeEnergy += magnitudes[bin * numFrames + frame]
      if (cumulativeEnergy >= threshold) {
        rolloffFreq = freqs[bin]
        break
      }
    }

    totalRolloff += rolloffFreq
    validFrames++
  }

  return validFrames > 0 ? totalRolloff / validFrames : 0
}
