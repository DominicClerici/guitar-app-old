import type { Tuning } from "./types"

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const

export const NOTE_NAMES_FLAT = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const

export type NoteName = (typeof NOTE_NAMES)[number]

export const STANDARD_TUNING: Tuning = {
  name: "Standard",
  stringNotes: [4, 9, 2, 7, 11, 4], // E, A, D, G, B, E
}

export const MAX_FRET = 18
export const STRING_COUNT = 6

export const ALTERNATE_TUNINGS: Record<string, Tuning> = {
  standard: STANDARD_TUNING,
  dropD: { name: "Drop D", stringNotes: [2, 9, 2, 7, 11, 4] },
  halfStepDown: { name: "Half Step Down", stringNotes: [3, 8, 1, 6, 10, 3] },
  openG: { name: "Open G", stringNotes: [2, 7, 2, 7, 11, 2] },
  openD: { name: "Open D", stringNotes: [2, 9, 2, 6, 9, 2] },
  dadgad: { name: "DADGAD", stringNotes: [2, 9, 2, 7, 9, 2] },
}
