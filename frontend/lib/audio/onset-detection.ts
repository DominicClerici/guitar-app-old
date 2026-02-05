export interface OnsetDetectionOptions {
  frameSize?: number
  hopSize?: number
  threshold?: number
  minInterOnsetMs?: number
}

export interface DetectedOnset {
  timeMs: number
  strength: number
}

export function detectOnsets(
  samples: Float32Array,
  sampleRate: number,
  options?: OnsetDetectionOptions,
): DetectedOnset[] {
  const frameSize = options?.frameSize ?? 2048
  const hopSize = options?.hopSize ?? 512
  const threshold = options?.threshold ?? 0.3
  const minInterOnsetMs = options?.minInterOnsetMs ?? 100

  const numFrames = Math.floor((samples.length - frameSize) / hopSize) + 1
  if (numFrames < 2) return []

  const energy = new Float32Array(numFrames)
  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize
    let sum = 0
    for (let i = start; i < start + frameSize; i++) {
      sum += samples[i] * samples[i]
    }
    energy[f] = Math.sqrt(sum / frameSize)
  }

  const onsetStrength = new Float32Array(numFrames)
  let maxStrength = 0
  for (let f = 1; f < numFrames; f++) {
    onsetStrength[f] = Math.max(0, energy[f] - energy[f - 1])
    if (onsetStrength[f] > maxStrength) maxStrength = onsetStrength[f]
  }

  if (maxStrength === 0) return []

  for (let f = 0; f < numFrames; f++) {
    onsetStrength[f] /= maxStrength
  }

  const absoluteThreshold = threshold
  const minInterOnsetFrames = Math.floor(
    (minInterOnsetMs / 1000) * (sampleRate / hopSize),
  )

  const peaks: DetectedOnset[] = []
  for (let f = 1; f < numFrames - 1; f++) {
    if (
      onsetStrength[f] > absoluteThreshold &&
      onsetStrength[f] > onsetStrength[f - 1] &&
      onsetStrength[f] >= onsetStrength[f + 1]
    ) {
      const timeMs = (f * hopSize / sampleRate) * 1000

      if (peaks.length > 0) {
        const lastPeak = peaks[peaks.length - 1]
        const lastFrame = Math.round(
          (lastPeak.timeMs / 1000) * sampleRate / hopSize,
        )
        if (f - lastFrame < minInterOnsetFrames) {
          if (onsetStrength[f] > lastPeak.strength) {
            peaks[peaks.length - 1] = { timeMs, strength: onsetStrength[f] }
          }
          continue
        }
      }

      peaks.push({ timeMs, strength: onsetStrength[f] })
    }
  }

  return peaks
}

export function onsetsToIntervals(
  onsets: DetectedOnset[],
  totalDurationMs: number,
): { startMs: number; endMs: number }[] {
  if (onsets.length === 0) {
    return [{ startMs: 0, endMs: totalDurationMs }]
  }

  const intervals: { startMs: number; endMs: number }[] = []

  for (let i = 0; i < onsets.length; i++) {
    const startMs = onsets[i].timeMs
    const endMs = i < onsets.length - 1 ? onsets[i + 1].timeMs : totalDurationMs
    intervals.push({ startMs, endMs })
  }

  return intervals
}
