export { Fretboard } from "./Fretboard"
export type { FretboardProps } from "./Fretboard"
export { FretMarker } from "./FretMarker"
export type { FretMarkerProps } from "./FretMarker"
export {
  // Arpeggio exports
  ARPEGGIO_LABELS,
  ARPEGGIO_SHORT_LABELS,
  ARPEGGIO_TYPES,
  type ArpeggioType,
  findOrCreateArpeggioBoxForFret,
  getArpeggioBoxPositions,
  getArpeggioNotes,
  getArpeggioPositions,
  getArpeggioPositionsWithWrap,
  // Scale/fretboard exports
  DOUBLE_DOT_FRETS,
  findOrCreateBoxForFret,
  FRET_COUNT,
  getNoteAtPosition,
  getOctaveAtPosition,
  getPositionsForNote,
  getPositionsForNoteWithOctave,
  getScaleBoxPositions,
  getScaleNotes,
  getScalePositions,
  getScalePositionsWithWrap,
  type NoteName,
  NOTES,
  type ScaleType,
  SINGLE_DOT_FRETS,
  STANDARD_TUNING,
  STANDARD_TUNING_OCTAVES,
} from "./fretboardData"
export type {
  ArpeggioBoxPosition,
  ArpeggioPosition,
  FretPosition,
  FretPositionWithOctave,
  ScaleBoxPosition,
  ScalePosition,
} from "./fretboardData"
