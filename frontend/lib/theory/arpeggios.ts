import type { NoteFormula } from "./types"

export const ARPEGGIO_FORMULAS: Record<string, NoteFormula> = {
  major: {
    id: "major",
    name: "Major",
    category: "arpeggio",
    intervals: [0, 4, 7],
    chordTones: [0, 1, 2],
  },
  minor: {
    id: "minor",
    name: "Minor",
    category: "arpeggio",
    intervals: [0, 3, 7],
    chordTones: [0, 1, 2],
  },
  diminished: {
    id: "diminished",
    name: "Diminished",
    category: "arpeggio",
    intervals: [0, 3, 6],
    chordTones: [0, 1, 2],
  },
  augmented: {
    id: "augmented",
    name: "Augmented",
    category: "arpeggio",
    intervals: [0, 4, 8],
    chordTones: [0, 1, 2],
  },
  dom7: {
    id: "dom7",
    name: "Dominant 7",
    category: "arpeggio",
    intervals: [0, 4, 7, 10],
    chordTones: [0, 1, 2, 3],
  },
  maj7: {
    id: "maj7",
    name: "Major 7",
    category: "arpeggio",
    intervals: [0, 4, 7, 11],
    chordTones: [0, 1, 2, 3],
  },
  min7: {
    id: "min7",
    name: "Minor 7",
    category: "arpeggio",
    intervals: [0, 3, 7, 10],
    chordTones: [0, 1, 2, 3],
  },
  min7b5: {
    id: "min7b5",
    name: "Minor 7b5",
    category: "arpeggio",
    intervals: [0, 3, 6, 10],
    chordTones: [0, 1, 2, 3],
  },
  dim7: {
    id: "dim7",
    name: "Diminished 7",
    category: "arpeggio",
    intervals: [0, 3, 6, 9],
    chordTones: [0, 1, 2, 3],
  },
}

export const ALL_ARPEGGIOS = Object.values(ARPEGGIO_FORMULAS)
