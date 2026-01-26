export type {
  CAGEDPosition,
  CAGEDShapeName,
  FretboardNote,
  NoteFilter,
  NoteFormula,
  ScaleNote,
  Tuning,
} from "./types"

export {
  ALTERNATE_TUNINGS,
  MAX_FRET,
  NOTE_NAMES,
  NOTE_NAMES_FLAT,
  STANDARD_TUNING,
  STRING_COUNT,
  type NoteName,
} from "./constants"

export { getIntervalFromSemitones, getIntervalName, INTERVALS, type Interval } from "./intervals"

export { ALL_SCALES, MAJOR_SCALE_INTERVALS, SCALE_FORMULAS } from "./scales"

export { ALL_MODES, MODE_FORMULAS } from "./modes"

export { ALL_ARPEGGIOS, ARPEGGIO_FORMULAS } from "./arpeggios"

export { generateFretboardNotes, getMajorScale, getNoteAtFret, getNoteName } from "./fretboard"

export {
  CAGED_SHAPE_NAMES,
  getAllCAGEDPositions,
  getCAGEDFretRange,
  getCAGEDPosition,
  getCAGEDShapeNotes,
} from "./caged"

export {
  filterNotes,
  getChordTones,
  getNotesByDegrees,
  getNotesInFretRange,
  getRootNotes,
} from "./filters"

import { ARPEGGIO_FORMULAS } from "./arpeggios"
import { MODE_FORMULAS } from "./modes"
import { SCALE_FORMULAS } from "./scales"
import type { NoteFormula } from "./types"

export function getAllFormulas(): NoteFormula[] {
  return [
    ...Object.values(SCALE_FORMULAS),
    ...Object.values(MODE_FORMULAS),
    ...Object.values(ARPEGGIO_FORMULAS),
  ]
}

export function getFormulaById(id: string): NoteFormula | undefined {
  return SCALE_FORMULAS[id] ?? MODE_FORMULAS[id] ?? ARPEGGIO_FORMULAS[id]
}
