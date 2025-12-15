/**
 * Comprehensive Chord Identifier - Type Definitions
 *
 * This module contains all the type definitions, enums, and constants
 * used throughout the chord identification system.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * All 12 pitch classes using sharps as canonical representation
 */
export enum PitchClass {
  C = 0,
  Cs = 1, // C# / Db
  D = 2,
  Ds = 3, // D# / Eb
  E = 4,
  F = 5,
  Fs = 6, // F# / Gb
  G = 7,
  Gs = 8, // G# / Ab
  A = 9,
  As = 10, // A# / Bb
  B = 11,
}

/**
 * Interval quality for proper naming
 */
export enum IntervalQuality {
  Perfect = "P",
  Major = "M",
  Minor = "m",
  Augmented = "A",
  Diminished = "d",
  DoublyAugmented = "AA",
  DoublyDiminished = "dd",
}

/**
 * Chord quality categories
 */
export enum ChordQuality {
  Major = "major",
  Minor = "minor",
  Diminished = "diminished",
  Augmented = "augmented",
  Dominant = "dominant",
  HalfDiminished = "half-diminished",
  Sus2 = "sus2",
  Sus4 = "sus4",
  Power = "power",
  Altered = "altered",
  Quartal = "quartal",
  Cluster = "cluster",
  Ambiguous = "ambiguous",
}

/**
 * Warning severity levels
 */
export enum WarningSeverity {
  Info = "info",
  Caution = "caution",
  Warning = "warning",
  Critical = "critical",
}

/**
 * Warning categories for chord issues
 */
export enum WarningCategory {
  Dissonance = "dissonance",
  Ambiguity = "ambiguity",
  Voicing = "voicing",
  Enharmonic = "enharmonic",
  Theoretical = "theoretical",
  Practical = "practical",
  Style = "style",
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Represents a musical note with its pitch class and optional octave
 */
export interface Note {
  pitchClass: PitchClass
  originalName: string // The original input string (e.g., "Db", "C#")
  preferFlat: boolean // Whether the input used flat notation
  octave?: number // Optional octave information
}

/**
 * Represents an interval from the root
 */
export interface Interval {
  semitones: number // Distance in semitones (0-11 for simple intervals)
  name: string // Human readable name (e.g., "major 3rd")
  shortName: string // Short notation (e.g., "M3", "m7")
  degree: number // Scale degree (1-13)
  quality: IntervalQuality
  isCompound: boolean // Whether it's above an octave
}

/**
 * A chord formula defining intervals from the root
 */
export interface ChordFormula {
  name: string // Full name (e.g., "major seventh")
  symbol: string // Primary symbol (e.g., "maj7")
  alternateSymbols: string[] // Alternative symbols (e.g., ["Δ7", "M7"])
  intervals: number[] // Semitones from root [0, 4, 7, 11]
  requiredIntervals: number[] // Intervals that MUST be present
  optionalIntervals: number[] // Intervals that may be omitted
  quality: ChordQuality
  category: ChordCategory
  rarity: number // 1-10, where 1 is most common
  description?: string
}

/**
 * Chord categories for organization
 */
export enum ChordCategory {
  Triad = "triad",
  Seventh = "seventh",
  Extended = "extended",
  Altered = "altered",
  Suspended = "suspended",
  Added = "added",
  Power = "power",
  Quartal = "quartal",
  Polychord = "polychord",
  Cluster = "cluster",
  Slash = "slash",
  Other = "other",
}

/**
 * A warning about a chord voicing or interpretation
 */
export interface ChordWarning {
  severity: WarningSeverity
  category: WarningCategory
  title: string
  message: string
  suggestion?: string
  affectedIntervals?: number[]
}

/**
 * A possible chord interpretation
 */
export interface ChordInterpretation {
  root: Note
  bass?: Note // For slash chords
  formula: ChordFormula
  presentIntervals: number[]
  missingIntervals: number[]
  extraNotes: number[] // Notes not in the formula
  inversion: number // 0 = root position, 1 = first inversion, etc.
  confidence: number // 0-100 score
  fullName: string // Complete chord name (e.g., "C major 7")
  symbol: string // Chord symbol (e.g., "Cmaj7")
  alternateSymbols: string[]
  warnings: ChordWarning[]
  voicingNotes: string[] // Notes in order as voiced
  enharmonicAlternatives?: ChordInterpretation[] // Same chord, different spelling
}

/**
 * Result of chord identification
 */
export interface ChordIdentificationResult {
  inputNotes: Note[]
  interpretations: ChordInterpretation[]
  globalWarnings: ChordWarning[]
  isValidChord: boolean
  processingTime: number // milliseconds
}

/**
 * Configuration options for chord identification
 */
export interface ChordIdentifierOptions {
  maxInterpretations?: number // Limit results (default: 20)
  includeSlashChords?: boolean // Consider slash chord interpretations
  includePolychords?: boolean // Consider polychord interpretations
  preferFlats?: boolean // Prefer flat notation in output
  preferSharps?: boolean // Prefer sharp notation in output
  jazzMode?: boolean // Prioritize jazz voicings and extensions
  classicalMode?: boolean // Prioritize classical interpretations
  strictMode?: boolean // Only exact matches, no omitted notes
  includeTheoreticalChords?: boolean // Include rare/theoretical chords
  minConfidence?: number // Minimum confidence threshold (0-100)
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Note name mappings (sharp-based)
 */
export const NOTE_NAMES_SHARP: Record<PitchClass, string> = {
  [PitchClass.C]: "C",
  [PitchClass.Cs]: "C#",
  [PitchClass.D]: "D",
  [PitchClass.Ds]: "D#",
  [PitchClass.E]: "E",
  [PitchClass.F]: "F",
  [PitchClass.Fs]: "F#",
  [PitchClass.G]: "G",
  [PitchClass.Gs]: "G#",
  [PitchClass.A]: "A",
  [PitchClass.As]: "A#",
  [PitchClass.B]: "B",
}

/**
 * Note name mappings (flat-based)
 */
export const NOTE_NAMES_FLAT: Record<PitchClass, string> = {
  [PitchClass.C]: "C",
  [PitchClass.Cs]: "Db",
  [PitchClass.D]: "D",
  [PitchClass.Ds]: "Eb",
  [PitchClass.E]: "E",
  [PitchClass.F]: "F",
  [PitchClass.Fs]: "Gb",
  [PitchClass.G]: "G",
  [PitchClass.Gs]: "Ab",
  [PitchClass.A]: "A",
  [PitchClass.As]: "Bb",
  [PitchClass.B]: "B",
}

/**
 * Interval names by semitone count
 */
export const INTERVAL_NAMES: Record<
  number,
  { name: string; shortName: string; degree: number; quality: IntervalQuality }
> = {
  0: { name: "unison", shortName: "P1", degree: 1, quality: IntervalQuality.Perfect },
  1: { name: "minor 2nd", shortName: "m2", degree: 2, quality: IntervalQuality.Minor },
  2: { name: "major 2nd", shortName: "M2", degree: 2, quality: IntervalQuality.Major },
  3: { name: "minor 3rd", shortName: "m3", degree: 3, quality: IntervalQuality.Minor },
  4: { name: "major 3rd", shortName: "M3", degree: 3, quality: IntervalQuality.Major },
  5: { name: "perfect 4th", shortName: "P4", degree: 4, quality: IntervalQuality.Perfect },
  6: { name: "tritone", shortName: "TT", degree: 4, quality: IntervalQuality.Augmented }, // or dim5
  7: { name: "perfect 5th", shortName: "P5", degree: 5, quality: IntervalQuality.Perfect },
  8: { name: "minor 6th", shortName: "m6", degree: 6, quality: IntervalQuality.Minor },
  9: { name: "major 6th", shortName: "M6", degree: 6, quality: IntervalQuality.Major },
  10: { name: "minor 7th", shortName: "m7", degree: 7, quality: IntervalQuality.Minor },
  11: { name: "major 7th", shortName: "M7", degree: 7, quality: IntervalQuality.Major },
}

/**
 * Extended interval names (compound intervals)
 */
export const EXTENDED_INTERVAL_NAMES: Record<
  number,
  { name: string; shortName: string; degree: number }
> = {
  12: { name: "octave", shortName: "P8", degree: 8 },
  13: { name: "minor 9th", shortName: "m9", degree: 9 },
  14: { name: "major 9th", shortName: "M9", degree: 9 },
  15: { name: "minor 10th", shortName: "m10", degree: 10 },
  16: { name: "major 10th", shortName: "M10", degree: 10 },
  17: { name: "perfect 11th", shortName: "P11", degree: 11 },
  18: { name: "augmented 11th", shortName: "#11", degree: 11 },
  19: { name: "perfect 12th", shortName: "P12", degree: 12 },
  20: { name: "minor 13th", shortName: "m13", degree: 13 },
  21: { name: "major 13th", shortName: "M13", degree: 13 },
}

/**
 * Common enharmonic equivalents
 */
export const ENHARMONIC_EQUIVALENTS: Record<string, string[]> = {
  C: ["B#", "Dbb"],
  "C#": ["Db"],
  D: ["C##", "Ebb"],
  "D#": ["Eb"],
  E: ["D##", "Fb"],
  F: ["E#", "Gbb"],
  "F#": ["Gb"],
  G: ["F##", "Abb"],
  "G#": ["Ab"],
  A: ["G##", "Bbb"],
  "A#": ["Bb"],
  B: ["A##", "Cb"],
}

/**
 * Scale degree names (for interval context)
 */
export const SCALE_DEGREE_NAMES: Record<number, string> = {
  1: "root",
  2: "second",
  3: "third",
  4: "fourth",
  5: "fifth",
  6: "sixth",
  7: "seventh",
  8: "octave",
  9: "ninth",
  10: "tenth",
  11: "eleventh",
  12: "twelfth",
  13: "thirteenth",
}

/**
 * Keys that typically prefer flats
 */
export const FLAT_KEYS = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"]

/**
 * Keys that typically prefer sharps
 */
export const SHARP_KEYS = ["G", "D", "A", "E", "B", "F#", "C#"]
