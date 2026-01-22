import type { NoteFormula } from "./types"

export const MODE_FORMULAS: Record<string, NoteFormula> = {
  ionian: {
    id: "ionian",
    name: "Ionian",
    category: "mode",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    parentScale: "major",
    modeNumber: 1,
    chordTones: [0, 2, 4],
  },
  dorian: {
    id: "dorian",
    name: "Dorian",
    category: "mode",
    intervals: [0, 2, 3, 5, 7, 9, 10],
    parentScale: "major",
    modeNumber: 2,
    chordTones: [0, 2, 4],
  },
  phrygian: {
    id: "phrygian",
    name: "Phrygian",
    category: "mode",
    intervals: [0, 1, 3, 5, 7, 8, 10],
    parentScale: "major",
    modeNumber: 3,
    chordTones: [0, 2, 4],
  },
  lydian: {
    id: "lydian",
    name: "Lydian",
    category: "mode",
    intervals: [0, 2, 4, 6, 7, 9, 11],
    parentScale: "major",
    modeNumber: 4,
    chordTones: [0, 2, 4],
  },
  mixolydian: {
    id: "mixolydian",
    name: "Mixolydian",
    category: "mode",
    intervals: [0, 2, 4, 5, 7, 9, 10],
    parentScale: "major",
    modeNumber: 5,
    chordTones: [0, 2, 4],
  },
  aeolian: {
    id: "aeolian",
    name: "Aeolian",
    category: "mode",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    parentScale: "major",
    modeNumber: 6,
    chordTones: [0, 2, 4],
  },
  locrian: {
    id: "locrian",
    name: "Locrian",
    category: "mode",
    intervals: [0, 1, 3, 5, 6, 8, 10],
    parentScale: "major",
    modeNumber: 7,
    chordTones: [0, 2, 4],
  },
}

export const ALL_MODES = Object.values(MODE_FORMULAS)
