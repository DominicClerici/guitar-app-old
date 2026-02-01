import FFT from "fft.js"

// Librosa-compatible MFCC implementation
// Matches librosa's default parameters: htk=False (Slaney mel scale), norm='slaney'

// Slaney mel scale constants (matches librosa with htk=False)
const F_MIN = 0.0
const F_SP = 200.0 / 3 // ~66.67 Hz per mel below 1000 Hz
const MIN_LOG_HZ = 1000.0 // Beginning of log region
const MIN_LOG_MEL = (MIN_LOG_HZ - F_MIN) / F_SP // = 15.0
const LOGSTEP = Math.log(6.4) / 27.0 // Step size for log region

// Convert Hz to Mel using Slaney's formula (librosa default, htk=False)
export function hzToMel(hz: number): number {
  if (hz < MIN_LOG_HZ) {
    // Linear region: below 1000 Hz
    return (hz - F_MIN) / F_SP
  } else {
    // Log region: 1000 Hz and above
    return MIN_LOG_MEL + Math.log(hz / MIN_LOG_HZ) / LOGSTEP
  }
}

// Convert Mel to Hz using Slaney's formula (librosa default, htk=False)
export function melToHz(mel: number): number {
  if (mel < MIN_LOG_MEL) {
    // Linear region
    return F_MIN + F_SP * mel
  } else {
    // Log region
    return MIN_LOG_HZ * Math.exp(LOGSTEP * (mel - MIN_LOG_MEL))
  }
}

// Generate mel frequencies (matches librosa.mel_frequencies)
export function melFrequencies(nMels: number, fmin: number, fmax: number): Float32Array {
  const minMel = hzToMel(fmin)
  const maxMel = hzToMel(fmax)

  const mels = new Float32Array(nMels)
  for (let i = 0; i < nMels; i++) {
    mels[i] = minMel + (i * (maxMel - minMel)) / (nMels - 1)
  }

  const hz = new Float32Array(nMels)
  for (let i = 0; i < nMels; i++) {
    hz[i] = melToHz(mels[i])
  }

  return hz
}

// Generate FFT frequencies (matches librosa.fft_frequencies)
export function fftFrequencies(sr: number, nFft: number): Float32Array {
  const nBins = Math.floor(nFft / 2) + 1
  const freqs = new Float32Array(nBins)
  for (let i = 0; i < nBins; i++) {
    freqs[i] = (i * sr) / nFft
  }
  return freqs
}

// Create mel filterbank (matches librosa.filters.mel with norm='slaney')
export function createMelFilterbank(
  sr: number,
  nFft: number,
  nMels: number = 128,
  fmin: number = 0.0,
  fmax?: number,
): Float32Array[] {
  fmax = fmax ?? sr / 2

  const nBins = Math.floor(nFft / 2) + 1

  // Get mel band center frequencies (n_mels + 2 points for left/right edges)
  const melF = melFrequencies(nMels + 2, fmin, fmax)

  // Get FFT bin center frequencies
  const fftFreqs = fftFrequencies(sr, nFft)

  // Compute differences between mel points
  const fdiff = new Float32Array(nMels + 1)
  for (let i = 0; i < nMels + 1; i++) {
    fdiff[i] = melF[i + 1] - melF[i]
  }

  // Compute ramps: ramps[i][k] = melF[i] - fftFreqs[k]
  const ramps: Float32Array[] = []
  for (let i = 0; i < nMels + 2; i++) {
    const ramp = new Float32Array(nBins)
    for (let k = 0; k < nBins; k++) {
      ramp[k] = melF[i] - fftFreqs[k]
    }
    ramps.push(ramp)
  }

  // Build filterbank
  const filters: Float32Array[] = []
  for (let i = 0; i < nMels; i++) {
    const filter = new Float32Array(nBins)

    for (let k = 0; k < nBins; k++) {
      // Lower slope: -ramps[i][k] / fdiff[i]
      const lower = -ramps[i][k] / fdiff[i]
      // Upper slope: ramps[i+2][k] / fdiff[i+1]
      const upper = ramps[i + 2][k] / fdiff[i + 1]
      // Intersect with each other and zero
      filter[k] = Math.max(0, Math.min(lower, upper))
    }

    filters.push(filter)
  }

  // Apply Slaney normalization: divide by bandwidth (area normalization)
  for (let i = 0; i < nMels; i++) {
    const enorm = 2.0 / (melF[i + 2] - melF[i])
    for (let k = 0; k < nBins; k++) {
      filters[i][k] *= enorm
    }
  }

  return filters
}

// Power to dB conversion (matches librosa.power_to_db)
export function powerToDb(
  S: Float32Array,
  ref: number = 1.0,
  amin: number = 1e-10,
  topDb: number = 80.0,
): Float32Array {
  const result = new Float32Array(S.length)

  // Find max for top_db clipping
  let maxVal = -Infinity

  for (let i = 0; i < S.length; i++) {
    const logSpec = 10.0 * Math.log10(Math.max(amin, S[i])) - 10.0 * Math.log10(Math.max(amin, ref))
    result[i] = logSpec
    if (logSpec > maxVal) {
      maxVal = logSpec
    }
  }

  // Clip to top_db below peak
  const threshold = maxVal - topDb
  for (let i = 0; i < S.length; i++) {
    result[i] = Math.max(result[i], threshold)
  }

  return result
}

// DCT Type-II with orthonormal normalization (matches scipy.fft.dct with norm='ortho')
export function dctType2Ortho(input: Float32Array, nOutput: number): Float32Array {
  const n = input.length
  const output = new Float32Array(nOutput)

  for (let k = 0; k < nOutput; k++) {
    let sum = 0
    for (let i = 0; i < n; i++) {
      sum += input[i] * Math.cos((Math.PI * k * (2 * i + 1)) / (2 * n))
    }

    // Ortho normalization
    if (k === 0) {
      output[k] = sum * Math.sqrt(1 / n)
    } else {
      output[k] = sum * Math.sqrt(2 / n)
    }
  }

  return output
}

// Mel spectrogram (matches librosa.feature.melspectrogram)
export function melspectrogram(
  samples: Float32Array,
  sampleRate: number,
  nFft: number = 2048,
  hopLength: number = 512,
  nMels: number = 128,
  fmin: number = 0.0,
  fmax?: number,
  center: boolean = true,
): Float32Array[] {
  fmax = fmax ?? sampleRate / 2

  // Create mel filterbank
  const melFilters = createMelFilterbank(sampleRate, nFft, nMels, fmin, fmax)
  const nBins = Math.floor(nFft / 2) + 1

  // Center padding (like librosa center=True)
  let paddedSamples: Float32Array
  if (center) {
    const padLength = Math.floor(nFft / 2)
    paddedSamples = new Float32Array(samples.length + 2 * padLength)
    paddedSamples.set(samples, padLength)
  } else {
    paddedSamples = samples
  }

  // Calculate number of frames
  const numFrames = Math.max(1, 1 + Math.floor((paddedSamples.length - nFft) / hopLength))

  // Hann window
  const hannWindow = new Float32Array(nFft)
  for (let i = 0; i < nFft; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nFft - 1)))
  }

  const fft = new FFT(nFft)
  const melSpec: Float32Array[] = []

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopLength
    const end = start + nFft

    if (end > paddedSamples.length) break

    // Apply window
    const frameSamples = new Float32Array(nFft)
    for (let i = 0; i < nFft; i++) {
      frameSamples[i] = paddedSamples[start + i] * hannWindow[i]
    }

    // Compute FFT
    const out = fft.createComplexArray()
    fft.realTransform(out, frameSamples)

    // Compute power spectrum
    const powerSpectrum = new Float32Array(nBins)
    for (let i = 0; i < nBins; i++) {
      const re = out[2 * i]
      const im = out[2 * i + 1]
      powerSpectrum[i] = re * re + im * im
    }

    // Apply mel filterbank
    const melEnergies = new Float32Array(nMels)
    for (let m = 0; m < nMels; m++) {
      let energy = 0
      for (let k = 0; k < nBins; k++) {
        energy += powerSpectrum[k] * melFilters[m][k]
      }
      melEnergies[m] = energy
    }

    melSpec.push(melEnergies)
  }

  return melSpec
}

// Power to dB for 2D spectrogram (matches librosa.power_to_db on full spectrogram)
// This ensures top_db clipping uses the global max across all frames
export function powerToDb2D(
  melSpec: Float32Array[],
  ref: number = 1.0,
  amin: number = 1e-10,
  topDb: number = 80.0,
): Float32Array[] {
  const numFrames = melSpec.length
  if (numFrames === 0) return []

  const nMels = melSpec[0].length
  const result: Float32Array[] = []

  // First pass: convert to dB and find global max
  let globalMax = -Infinity
  const logRefValue = 10.0 * Math.log10(Math.max(amin, ref))

  for (let f = 0; f < numFrames; f++) {
    const frame = new Float32Array(nMels)
    for (let m = 0; m < nMels; m++) {
      const logSpec = 10.0 * Math.log10(Math.max(amin, melSpec[f][m])) - logRefValue
      frame[m] = logSpec
      if (logSpec > globalMax) {
        globalMax = logSpec
      }
    }
    result.push(frame)
  }

  // Second pass: apply top_db clipping relative to global max
  const threshold = globalMax - topDb
  for (let f = 0; f < numFrames; f++) {
    for (let m = 0; m < nMels; m++) {
      result[f][m] = Math.max(result[f][m], threshold)
    }
  }

  return result
}

// MFCC extraction (matches librosa.feature.mfcc)
export function mfcc(
  samples: Float32Array,
  sampleRate: number,
  nMfcc: number = 13,
  nFft: number = 2048,
  hopLength: number = 512,
  nMels: number = 128,
  fmin: number = 0.0,
  fmax?: number,
): { mfccMean: number[]; mfccStd: number[] } {
  fmax = fmax ?? sampleRate / 2

  // Compute mel spectrogram
  const melSpec = melspectrogram(samples, sampleRate, nFft, hopLength, nMels, fmin, fmax)

  if (melSpec.length === 0) {
    return {
      mfccMean: new Array(nMfcc).fill(0),
      mfccStd: new Array(nMfcc).fill(0),
    }
  }

  // Convert to dB with global top_db clipping (matches librosa exactly)
  const melSpecDb = powerToDb2D(melSpec, 1.0, 1e-10, 80.0)

  // Apply DCT to each frame
  const allMfccs: Float32Array[] = melSpecDb.map((frame) => dctType2Ortho(frame, nMfcc))

  // Compute mean and std across frames
  const mfccMean = new Array(nMfcc).fill(0)
  const mfccStd = new Array(nMfcc).fill(0)

  for (const frameMfccs of allMfccs) {
    for (let i = 0; i < nMfcc; i++) {
      mfccMean[i] += frameMfccs[i]
    }
  }

  for (let i = 0; i < nMfcc; i++) {
    mfccMean[i] /= allMfccs.length
  }

  for (const frameMfccs of allMfccs) {
    for (let i = 0; i < nMfcc; i++) {
      const diff = frameMfccs[i] - mfccMean[i]
      mfccStd[i] += diff * diff
    }
  }

  for (let i = 0; i < nMfcc; i++) {
    mfccStd[i] = Math.sqrt(mfccStd[i] / allMfccs.length)
  }

  return { mfccMean, mfccStd }
}

// Single-window MFCC extraction (matches Python's extract_mfcc_single)
// Returns mean MFCCs across frames in a short window
export function extractMfccSingle(
  samples: Float32Array,
  sampleRate: number,
  nMfcc: number = 13,
): number[] {
  // Match Python: n_fft = min(2048, len(y))
  const nFft = Math.min(2048, samples.length)

  // Use librosa defaults
  const hopLength = 512
  const nMels = 128
  const fmin = 0.0
  const fmax = sampleRate / 2

  const { mfccMean } = mfcc(samples, sampleRate, nMfcc, nFft, hopLength, nMels, fmin, fmax)

  return mfccMean
}
