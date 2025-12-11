// map flats to sharps
const flatToSharp: Record<string, string> = {
  Ab: "G#",
  Bb: "A#",
  Cb: "B",
  Db: "C#",
  Eb: "D#",
  Fb: "E",
  Gb: "F#",
}

const chromaticScale = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"]

export type Note = keyof typeof flatToSharp | (typeof chromaticScale)[number]

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function applyTuningToNoteCharacter(note: Note, tuningOffset: number): Note {
  //   TODO: maybe performance where we lookup in flats instead of two conditions?
  const normalizedNote = flatToSharp[note] ?? note

  const currentIndex = chromaticScale.indexOf(normalizedNote)
  if (currentIndex === -1) {
    return note // Return original if not found
  }

  // Calculate new index with offset (each 0.5 = 1 half step)
  const halfSteps = Math.round(tuningOffset * 2)
  let newIndex = (currentIndex + halfSteps) % 12
  if (newIndex < 0) {
    newIndex += 12
  }

  return chromaticScale[newIndex]
}

export function getNoteFromFret(fret: number, fretBaseNote: Note): Note {
  return chromaticScale[(chromaticScale.indexOf(fretBaseNote) + fret) % 12]
}

export function getNoteFromMidi(midi: number): Note {
  return chromaticScale[((midi % 12) + 12) % 12]
}
