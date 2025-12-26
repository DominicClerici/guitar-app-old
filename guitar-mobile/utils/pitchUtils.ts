import { NOTES, type NoteName } from "@/components/fretboard"

// A4 reference frequency for calculating note frequencies
const A4_FREQUENCY = 440

// Frequency tolerance for note detection (±5%)
export const FREQUENCY_TOLERANCE = 0.05
// How long a note must be held to register (ms)
export const HOLD_DURATION_MS = 50

/**
 * Calculate the frequency of a note at a given octave
 */
export function getNoteFrequency(note: NoteName, octave: number): number {
  const noteIndex = NOTES.indexOf(note)
  if (noteIndex === -1) return 0
  // A4 is at index 9, octave 4
  const semitonesFromA4 = (octave - 4) * 12 + (noteIndex - 9)
  return A4_FREQUENCY * Math.pow(2, semitonesFromA4 / 12)
}

/**
 * Check if a detected frequency matches a target note within tolerance
 * Returns the octave if matched, or null if not matched
 */
export function frequencyMatchesNote(
  detectedFrequency: number,
  targetNote: NoteName,
  tolerancePercent: number = FREQUENCY_TOLERANCE,
): number | null {
  // Check octaves 2-6 (typical guitar range)
  for (let octave = 2; octave <= 6; octave++) {
    const targetFreq = getNoteFrequency(targetNote, octave)
    const minFreq = targetFreq * (1 - tolerancePercent)
    const maxFreq = targetFreq * (1 + tolerancePercent)

    if (detectedFrequency >= minFreq && detectedFrequency <= maxFreq) {
      return octave
    }
  }
  return null
}
