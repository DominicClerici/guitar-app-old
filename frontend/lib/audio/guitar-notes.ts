const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const

const STANDARD_TUNING_MIDI = [40, 45, 50, 55, 59, 64] // Low E to High E (string index 0-5)

export function getNoteName(stringIndex: number, fret: number): string {
  const openStringMidi = STANDARD_TUNING_MIDI[stringIndex]
  const midi = openStringMidi + fret
  const noteIndex = midi % 12
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

export function getNoteLabel(stringIndex: number, fret: number): string {
  const openStringMidi = STANDARD_TUNING_MIDI[stringIndex]
  const midi = openStringMidi + fret
  const noteIndex = midi % 12
  return NOTE_NAMES[noteIndex]
}
