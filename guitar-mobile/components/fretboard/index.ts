export { Fretboard } from "./Fretboard"
export type { FretboardProps } from "./Fretboard"
export { FretMarker } from "./FretMarker"
export type { FretMarkerProps } from "./FretMarker"
export {
  DOUBLE_DOT_FRETS,
  findOrCreateBoxForFret,
  FRET_COUNT,
  generateFretboardPositions,
  generateFretboardPositionsWithOctave,
  getBoxIndexForFret,
  getNoteAtPosition,
  getOctaveAtPosition,
  getPositionsForNote,
  getPositionsForNoteWithOctave,
  getScaleBoxPositions,
  getScaleDegree,
  getScaleNotes,
  getScalePositions,
  getScalePositionsInRange,
  getScalePositionsWithWrap,
  type NoteName,
  NOTES,
  SCALE_INTERVALS,
  type ScaleType,
  SINGLE_DOT_FRETS,
  STANDARD_TUNING,
  STANDARD_TUNING_OCTAVES,
  STRING_NAMES,
} from "./fretboardData"
export type {
  FretPosition,
  FretPositionWithOctave,
  ScaleBoxPosition,
  ScalePosition,
} from "./fretboardData"
