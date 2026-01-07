// Note names using sharps (prefer sharps over flats)
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
export type NoteName = (typeof NOTE_NAMES)[number]

export const STRING_OPEN_MIDI = [40, 45, 50, 55, 59, 64] // E2, A2, D3, G3, B3, E4

// A4 = 440 Hz is the reference pitch (MIDI note 69)
const A4_FREQ = 440
const A4_MIDI = 69
// Frequency range: E1 (~41.2 Hz) to E6 (~1318.5 Hz)
// E1 is MIDI note 28, E6 is MIDI note 88
const MIN_MIDI = 28 // E1
const MAX_MIDI = 88 // E6

// Convert frequency to MIDI note number (can be fractional)
export function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / A4_FREQ) + A4_MIDI
}

// Convert MIDI note number to frequency
export function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12)
}

// Get note name and octave from MIDI note number
export function midiToNoteName(midi: number): string {
  const noteIndex = midi % 12
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[noteIndex]}${octave}`
}
// Get the closest note name to a given frequency
export function getClosestNoteName(freq: number): string | null {
  if (freq <= 0) return null

  const midiNote = freqToMidi(freq)
  if (midiNote < MIN_MIDI - 0.5 || midiNote > MAX_MIDI + 0.5) return null

  const nearestMidi = Math.round(midiNote)
  const clampedMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, nearestMidi))
  return midiToNoteName(clampedMidi)
}

// Get note name only if frequency is within threshold of the note
// Threshold is a percentage (0.05 = 5%) of the distance to the neighboring semitone
export function getNoteWithThreshold(freq: number, threshold: number): string | null {
  if (freq <= 0) return null

  const midiNote = freqToMidi(freq)
  if (midiNote < MIN_MIDI - 0.5 || midiNote > MAX_MIDI + 0.5) return null

  const nearestMidi = Math.round(midiNote)
  const clampedMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, nearestMidi))
  const deviation = midiNote - clampedMidi // deviation in semitones (-0.5 to 0.5)

  // Each semitone is 1.0 in MIDI units, so threshold of 0.05 means within 5% of a semitone
  // A semitone spans -0.5 to +0.5 from the note center, so full range to neighbor is 0.5
  if (Math.abs(deviation) > threshold * 0.5) return null

  return midiToNoteName(clampedMidi)
}

// Get cents deviation from the closest note
export function getCentsDeviation(freq: number): number | null {
  if (freq <= 0) return null

  const midiNote = freqToMidi(freq)
  if (midiNote < MIN_MIDI - 0.5 || midiNote > MAX_MIDI + 0.5) return null

  const nearestMidi = Math.round(midiNote)
  const clampedMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, nearestMidi))
  const targetFreq = midiToFreq(clampedMidi)
  return 1200 * Math.log2(freq / targetFreq)
}
