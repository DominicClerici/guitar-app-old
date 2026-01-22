export type {
  FretboardNote,
  ScaleNote,
  NoteFormula,
  Tuning,
  CAGEDPosition,
  CAGEDShapeName,
  NoteFilter,
} from "./types"

export {
  NOTE_NAMES,
  NOTE_NAMES_FLAT,
  type NoteName,
  STANDARD_TUNING,
  ALTERNATE_TUNINGS,
  MAX_FRET,
  STRING_COUNT,
} from "./constants"

export { INTERVALS, getIntervalName, getIntervalFromSemitones, type Interval } from "./intervals"

export { SCALE_FORMULAS, MAJOR_SCALE_INTERVALS, ALL_SCALES } from "./scales"

export { MODE_FORMULAS, ALL_MODES } from "./modes"

export { ARPEGGIO_FORMULAS, ALL_ARPEGGIOS } from "./arpeggios"

export {
  getNoteAtFret,
  getNoteName,
  generateFretboardNotes,
  getMajorScale,
} from "./fretboard"

export {
  CAGED_SHAPE_NAMES,
  getCAGEDPosition,
  getCAGEDFretRange,
  getCAGEDShapeNotes,
  getAllCAGEDPositions,
} from "./caged"

export {
  filterNotes,
  getRootNotes,
  getChordTones,
  getNotesInFretRange,
  getNotesByDegrees,
} from "./filters"

import { SCALE_FORMULAS } from "./scales"
import { MODE_FORMULAS } from "./modes"
import { ARPEGGIO_FORMULAS } from "./arpeggios"
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
