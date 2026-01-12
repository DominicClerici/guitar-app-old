export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
export type NoteName = (typeof NOTE_NAMES)[number]

export const STRING_OPEN_MIDI = [40, 45, 50, 55, 59, 64] // E2, A2, D3, G3, B3, E4

const A4_FREQ = 440
const A4_MIDI = 69
const MIN_MIDI = 28
const MAX_MIDI = 88

export function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / A4_FREQ) + A4_MIDI
}

export function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12)
}

export function midiToNoteName(midi: number): string {
  const noteIndex = midi % 12
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

export function getClosestNoteName(freq: number): string | null {
  if (freq <= 0) return null

  const midiNote = freqToMidi(freq)
  if (midiNote < MIN_MIDI - 0.5 || midiNote > MAX_MIDI + 0.5) return null

  const nearestMidi = Math.round(midiNote)
  const clampedMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, nearestMidi))
  return midiToNoteName(clampedMidi)
}

export function getCentsDeviation(freq: number): number | null {
  if (freq <= 0) return null

  const midiNote = freqToMidi(freq)
  if (midiNote < MIN_MIDI - 0.5 || midiNote > MAX_MIDI + 0.5) return null

  const nearestMidi = Math.round(midiNote)
  const clampedMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, nearestMidi))
  const targetFreq = midiToFreq(clampedMidi)
  return 1200 * Math.log2(freq / targetFreq)
}
