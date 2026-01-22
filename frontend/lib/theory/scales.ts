import type { NoteFormula } from "./types"

export const SCALE_FORMULAS: Record<string, NoteFormula> = {
  major: {
    id: "major",
    name: "Major",
    category: "scale",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    chordTones: [0, 2, 4],
  },
  naturalMinor: {
    id: "naturalMinor",
    name: "Natural Minor",
    category: "scale",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    chordTones: [0, 2, 4],
  },
  harmonicMinor: {
    id: "harmonicMinor",
    name: "Harmonic Minor",
    category: "scale",
    intervals: [0, 2, 3, 5, 7, 8, 11],
    chordTones: [0, 2, 4],
  },
  melodicMinor: {
    id: "melodicMinor",
    name: "Melodic Minor",
    category: "scale",
    intervals: [0, 2, 3, 5, 7, 9, 11],
    chordTones: [0, 2, 4],
  },
  majorPentatonic: {
    id: "majorPentatonic",
    name: "Major Pentatonic",
    category: "pentatonic",
    intervals: [0, 2, 4, 7, 9],
    chordTones: [0, 2],
  },
  minorPentatonic: {
    id: "minorPentatonic",
    name: "Minor Pentatonic",
    category: "pentatonic",
    intervals: [0, 3, 5, 7, 10],
    chordTones: [0, 2],
  },
  blues: {
    id: "blues",
    name: "Blues",
    category: "blues",
    intervals: [0, 3, 5, 6, 7, 10],
    chordTones: [0, 3],
  },
}

export const MAJOR_SCALE_INTERVALS = SCALE_FORMULAS.major.intervals

export const ALL_SCALES = Object.values(SCALE_FORMULAS)
