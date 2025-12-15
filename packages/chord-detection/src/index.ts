/**
 * Chord Identifier Library
 *
 * A comprehensive TypeScript library for identifying musical chords
 * from a set of notes.
 */

export {
  ChordCategory,
  ChordFormula,
  ChordIdentificationResult,
  ChordIdentifierOptions,
  ChordInterpretation,
  ChordQuality,
  ChordWarning,
  ENHARMONIC_EQUIVALENTS,
  EXTENDED_INTERVAL_NAMES,
  FLAT_KEYS,
  INTERVAL_NAMES,
  Interval,
  IntervalQuality,
  NOTE_NAMES_FLAT,
  NOTE_NAMES_SHARP,
  Note,
  PitchClass,
  SCALE_DEGREE_NAMES,
  SHARP_KEYS,
  WarningCategory,
  WarningSeverity,
} from "./types"

export {
  CHORD_FORMULAS,
  findFormulasWithIntervals,
  getFormulasByCategory,
  getFormulasByQuality,
  getFormulasByRarity,
} from "./formulas"

export {
  WARNING_RULES,
  WarningRule,
  getGlobalWarnings,
  getWarningsByCategory,
  getWarningsBySeverity,
  getWarningsForIntervals,
} from "./warnings"

export {
  formatNote,
  formatNotes,
  getAllNamesForPitchClass,
  getInterval,
  getIntervalsFromRoot,
  getPitchClassName,
  getUniquePitchClasses,
  inputPrefersFlats,
  normalizeIntervals,
  parseNote,
  parseNotes,
  sortNotesByPitch,
  validateNoteCount,
} from "./note-parser"

export { ChordIdentifier, getAllChordNames, getChordName, identifyChord } from "./chord-identifier"

export { ChordIdentifier as default } from "./chord-identifier"
