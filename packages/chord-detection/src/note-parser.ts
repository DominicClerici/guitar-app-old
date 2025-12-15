/**
 * Note Parser Utility
 *
 * Handles parsing of musical note names from various input formats.
 * Supports sharps, flats, double sharps/flats, and various notation styles.
 */

import { Note, NOTE_NAMES_FLAT, NOTE_NAMES_SHARP, PitchClass } from "./types"

/**
 * Mapping of note names to pitch classes
 */
const NOTE_TO_PITCH_CLASS: Record<string, PitchClass> = {
  // Natural notes
  C: PitchClass.C,
  D: PitchClass.D,
  E: PitchClass.E,
  F: PitchClass.F,
  G: PitchClass.G,
  A: PitchClass.A,
  B: PitchClass.B,

  // Sharp notes
  "C#": PitchClass.Cs,
  "D#": PitchClass.Ds,
  "E#": PitchClass.F,
  "F#": PitchClass.Fs,
  "G#": PitchClass.Gs,
  "A#": PitchClass.As,
  "B#": PitchClass.C,

  // Flat notes
  Cb: PitchClass.B,
  Db: PitchClass.Cs,
  Eb: PitchClass.Ds,
  Fb: PitchClass.E,
  Gb: PitchClass.Fs,
  Ab: PitchClass.Gs,
  Bb: PitchClass.As,

  // Double sharps
  "C##": PitchClass.D,
  Cx: PitchClass.D,
  "D##": PitchClass.E,
  Dx: PitchClass.E,
  "E##": PitchClass.Fs,
  Ex: PitchClass.Fs,
  "F##": PitchClass.G,
  Fx: PitchClass.G,
  "G##": PitchClass.A,
  Gx: PitchClass.A,
  "A##": PitchClass.B,
  Ax: PitchClass.B,
  "B##": PitchClass.Cs,
  Bx: PitchClass.Cs,

  // Double flats
  Cbb: PitchClass.As,
  Dbb: PitchClass.C,
  Ebb: PitchClass.D,
  Fbb: PitchClass.Ds,
  Gbb: PitchClass.F,
  Abb: PitchClass.G,
  Bbb: PitchClass.A,
}

/**
 * German notation mappings
 */
const GERMAN_NOTATION: Record<string, string> = {
  ais: "A#",
  bis: "B#",
  cis: "C#",
  dis: "D#",
  eis: "E#",
  fis: "F#",
  gis: "G#",
  his: "B#",
  as: "Ab",
  bes: "Bb",
  ces: "Cb",
  des: "Db",
  es: "Eb",
  fes: "Fb",
  ges: "Gb",
  Ais: "A#",
  Bis: "B#",
  Cis: "C#",
  Dis: "D#",
  Eis: "E#",
  Fis: "F#",
  Gis: "G#",
  His: "B#",
  As: "Ab",
  Bes: "Bb",
  Ces: "Cb",
  Des: "Db",
  Es: "Eb",
  Fes: "Fb",
  Ges: "Gb",
  h: "B",
  H: "B",
}

/**
 * Normalize a note string to standard notation
 */
function normalizeNoteName(input: string) {
  let normalized = input.trim()

  // Check German notation first
  if (GERMAN_NOTATION[normalized]) {
    return GERMAN_NOTATION[normalized]!
  }

  // Replace unicode symbols
  normalized = normalized
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/𝄪/g, "##")
    .replace(/𝄫/g, "bb")
    .replace(/♮/g, "")

  // Handle 'x' for double sharp
  if (normalized.length === 2 && normalized[1]?.toLowerCase() === "x") {
    normalized = normalized[0]?.toUpperCase() + "##"
  }

  // Capitalize the note letter, keep modifiers
  if (normalized.length > 0) {
    const letter = normalized[0]?.toUpperCase()
    const modifiers = normalized.slice(1).toLowerCase().replace(/b/g, "b")
    normalized = letter + modifiers
  }

  return normalized
}

/**
 * Extract octave number from note string if present
 */
function extractOctave(input: string) {
  const match = input.match(/^([A-Ga-g][#b♯♭x]*|[A-Ga-g](?:is|es|bb|##)?)(-?\d+)?$/i)
  if (match) {
    return {
      noteName: match[1]!,
      octave: match[2] ? parseInt(match[2], 10) : undefined,
    }
  }
  return { noteName: input, octave: undefined }
}

/**
 * Parse a single note string into a Note object
 */
export function parseNote(input: string): Note | null {
  if (!input || typeof input !== "string") {
    return null
  }

  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return null
  }

  const { noteName, octave } = extractOctave(trimmed)
  const normalized = normalizeNoteName(noteName)
  const pitchClass = NOTE_TO_PITCH_CLASS[normalized]

  if (!pitchClass) {
    return null
  }

  const preferFlat =
    normalized.includes("b") ||
    input.includes("♭") ||
    input.toLowerCase().includes("es") ||
    input.toLowerCase() === "as"

  return {
    pitchClass,
    originalName: trimmed,
    preferFlat,
    octave: octave ?? 0,
  }
}

/**
 * Try to parse concatenated notes (e.g., "CEG" -> ["C", "E", "G"])
 */
function parseConcatenatedNotes(input: string): string[] {
  const notes: string[] = []
  let i = 0

  while (i < input.length) {
    if (!/[A-Ga-g]/.test(input[i]!)) {
      return []
    }

    let note = input[i]
    i++

    while (i < input.length && /[#bx♯♭]/.test(input[i]!)) {
      note += input[i]!
      i++
    }

    while (i < input.length && /\d/.test(input[i]!)) {
      note += input[i]!
      i++
    }

    notes.push(note!)
  }

  return notes
}

/**
 * Parse multiple notes from various input formats
 */
export function parseNotes(input: string | string[]): Note[] {
  let noteStrings: string[]

  if (Array.isArray(input)) {
    noteStrings = input
  } else if (typeof input === "string") {
    const trimmed = input.trim()

    if (trimmed.includes(",")) {
      noteStrings = trimmed
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    } else if (trimmed.includes(" ")) {
      noteStrings = trimmed.split(/\s+/).filter((s) => s.length > 0)
    } else if (trimmed.includes("-") && !trimmed.match(/^[A-Ga-g][#b♯♭x]*-?\d+$/)) {
      noteStrings = trimmed
        .split("-")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    } else if (trimmed.includes("/")) {
      noteStrings = trimmed
        .split("/")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    } else {
      const concatenated = parseConcatenatedNotes(trimmed)
      noteStrings = concatenated.length > 1 ? concatenated : [trimmed]
    }
  } else {
    return []
  }

  const notes: Note[] = []
  for (const noteStr of noteStrings) {
    const note = parseNote(noteStr)
    if (note) {
      notes.push(note)
    }
  }

  return notes
}

/**
 * Get the display name for a pitch class
 */
export function getPitchClassName(pitchClass: PitchClass, preferFlat: boolean = false): string {
  return preferFlat ? NOTE_NAMES_FLAT[pitchClass] : NOTE_NAMES_SHARP[pitchClass]
}

/**
 * Get all possible names for a pitch class
 */
export function getAllNamesForPitchClass(pitchClass: PitchClass): string[] {
  const names: string[] = []
  names.push(NOTE_NAMES_SHARP[pitchClass])

  const flatName = NOTE_NAMES_FLAT[pitchClass]
  if (flatName !== NOTE_NAMES_SHARP[pitchClass]) {
    names.push(flatName)
  }

  return names
}

/**
 * Calculate the interval (in semitones) between two notes
 */
export function getInterval(from: Note, to: Note): number {
  let interval = to.pitchClass - from.pitchClass
  if (interval < 0) {
    interval += 12
  }
  return interval
}

/**
 * Get intervals from a root note to all other notes
 */
export function getIntervalsFromRoot(root: Note, notes: Note[]): number[] {
  return notes.map((note) => getInterval(root, note))
}

/**
 * Normalize intervals to be within 0-11 (single octave)
 */
export function normalizeIntervals(intervals: number[]): number[] {
  return [...new Set(intervals.map((i) => ((i % 12) + 12) % 12))].sort((a, b) => a - b)
}

/**
 * Get unique pitch classes from notes
 */
export function getUniquePitchClasses(notes: Note[]): PitchClass[] {
  return [...new Set(notes.map((n) => n.pitchClass))]
}

/**
 * Check if the overall input prefers flats based on majority
 */
export function inputPrefersFlats(notes: Note[]): boolean {
  const flatCount = notes.filter((n) => n.preferFlat).length
  return flatCount > notes.length / 2
}

/**
 * Sort notes by pitch class
 */
export function sortNotesByPitch(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => a.pitchClass - b.pitchClass)
}

/**
 * Validate that we have enough notes for chord identification
 */
export function validateNoteCount(notes: Note[]): { valid: boolean; message?: string } {
  const uniquePitches = getUniquePitchClasses(notes)

  if (uniquePitches.length < 2) {
    return {
      valid: false,
      message: "At least 2 different notes are required for chord identification",
    }
  }

  if (uniquePitches.length > 7) {
    return {
      valid: true,
      message: "Warning: More than 7 unique pitch classes - this may produce many interpretations",
    }
  }

  return { valid: true }
}

/**
 * Format a note for display
 */
export function formatNote(note: Note, preferFlat?: boolean): string {
  const useFlat = preferFlat ?? note.preferFlat
  const name = getPitchClassName(note.pitchClass, useFlat)
  return note.octave !== undefined ? `${name}${note.octave}` : name
}

/**
 * Format multiple notes for display
 */
export function formatNotes(notes: Note[], preferFlat?: boolean): string {
  return notes.map((n) => formatNote(n, preferFlat)).join(" ")
}
