// Note names for display
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
const FLAT_NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const

type NoteName = (typeof NOTE_NAMES)[number] | (typeof FLAT_NOTE_NAMES)[number]

// Input note can be a string like "E4", "C#3" or a MIDI number
export type NoteInput = string | number

import { analyzeChord } from "./analysis"
import { type ChordWarning, generateChordWarnings } from "./warning"

export interface ChordResult {
  name: string
  root: string
  quality: string
  bassNote: string | null
  intervals: number[]
  isInversion: boolean
  warnings: ChordWarning[] | null
}

// Internal type used during chord detection (before warnings are added)
interface ChordCandidate {
  name: string
  root: string
  quality: string
  bassNote: string | null
  intervals: number[]
  isInversion: boolean
  score: number
}

// Chord quality definitions: intervals from root (in semitones)
const CHORD_QUALITIES: Record<string, { intervals: number[]; name: string; priority: number }> = {
  // Triads (highest priority - simpler is better)
  major: { intervals: [0, 4, 7], name: "", priority: 1 },
  minor: { intervals: [0, 3, 7], name: "m", priority: 1 },
  diminished: { intervals: [0, 3, 6], name: "dim", priority: 2 },
  augmented: { intervals: [0, 4, 8], name: "aug", priority: 2 },
  sus2: { intervals: [0, 2, 7], name: "sus2", priority: 3 },
  sus4: { intervals: [0, 5, 7], name: "sus4", priority: 3 },

  // Power chord
  power: { intervals: [0, 7], name: "5", priority: 2 },

  // Seventh chords
  major7: { intervals: [0, 4, 7, 11], name: "maj7", priority: 4 },
  dominant7: { intervals: [0, 4, 7, 10], name: "7", priority: 4 },
  minor7: { intervals: [0, 3, 7, 10], name: "m7", priority: 4 },
  minorMajor7: { intervals: [0, 3, 7, 11], name: "mMaj7", priority: 5 },
  diminished7: { intervals: [0, 3, 6, 9], name: "dim7", priority: 5 },
  halfDiminished7: { intervals: [0, 3, 6, 10], name: "m7b5", priority: 5 },
  augmented7: { intervals: [0, 4, 8, 10], name: "aug7", priority: 5 },
  augmentedMajor7: { intervals: [0, 4, 8, 11], name: "augMaj7", priority: 6 },

  // Sixth chords
  major6: { intervals: [0, 4, 7, 9], name: "6", priority: 4 },
  minor6: { intervals: [0, 3, 7, 9], name: "m6", priority: 4 },

  // Add chords (no 7th)
  add9: { intervals: [0, 4, 7, 14], name: "add9", priority: 5 },
  minorAdd9: { intervals: [0, 3, 7, 14], name: "madd9", priority: 5 },
  add11: { intervals: [0, 4, 7, 17], name: "add11", priority: 6 },
  add13: { intervals: [0, 4, 7, 21], name: "add13", priority: 6 },

  // Extended chords (with 7th)
  dominant9: { intervals: [0, 4, 7, 10, 14], name: "9", priority: 6 },
  major9: { intervals: [0, 4, 7, 11, 14], name: "maj9", priority: 6 },
  minor9: { intervals: [0, 3, 7, 10, 14], name: "m9", priority: 6 },
  dominant11: { intervals: [0, 4, 7, 10, 14, 17], name: "11", priority: 7 },
  major11: { intervals: [0, 4, 7, 11, 14, 17], name: "maj11", priority: 7 },
  minor11: { intervals: [0, 3, 7, 10, 14, 17], name: "m11", priority: 7 },
  dominant13: { intervals: [0, 4, 7, 10, 14, 17, 21], name: "13", priority: 8 },
  major13: { intervals: [0, 4, 7, 11, 14, 17, 21], name: "maj13", priority: 8 },
  minor13: { intervals: [0, 3, 7, 10, 14, 17, 21], name: "m13", priority: 8 },

  // 6/9 chords
  sixNine: { intervals: [0, 4, 7, 9, 14], name: "6/9", priority: 5 },
  minorSixNine: { intervals: [0, 3, 7, 9, 14], name: "m6/9", priority: 5 },

  // Altered dominants
  dominant7b5: { intervals: [0, 4, 6, 10], name: "7b5", priority: 6 },
  dominant7sharp5: { intervals: [0, 4, 8, 10], name: "7#5", priority: 6 },
  dominant7b9: { intervals: [0, 4, 7, 10, 13], name: "7b9", priority: 7 },
  dominant7sharp9: { intervals: [0, 4, 7, 10, 15], name: "7#9", priority: 7 },
  dominant7b5b9: { intervals: [0, 4, 6, 10, 13], name: "7b5b9", priority: 8 },
  dominant7b5sharp9: { intervals: [0, 4, 6, 10, 15], name: "7b5#9", priority: 8 },
  dominant7sharp5b9: { intervals: [0, 4, 8, 10, 13], name: "7#5b9", priority: 8 },
  dominant7sharp5sharp9: { intervals: [0, 4, 8, 10, 15], name: "7#5#9", priority: 8 },
  dominant7sharp11: { intervals: [0, 4, 7, 10, 18], name: "7#11", priority: 7 },
  dominant13b9: { intervals: [0, 4, 7, 10, 13, 21], name: "13b9", priority: 8 },

  // Sus chords with 7th
  sus4_7: { intervals: [0, 5, 7, 10], name: "7sus4", priority: 5 },
  sus2_7: { intervals: [0, 2, 7, 10], name: "7sus2", priority: 5 },
}

/**
 * Parse a note string (like "C4", "F#3", "Bb5") to MIDI number
 */
function parseNoteToMidi(note: string): number {
  const match = note.match(/^([A-Ga-g])([#b]?)(-?\d+)$/)
  if (!match) {
    throw new Error(`Invalid note format: ${note}. Expected format like "C4", "F#3", "Bb5"`)
  }

  const noteLetter = match[1]!
  const accidental = match[2]
  const octaveStr = match[3]!
  const octave = parseInt(octaveStr, 10)

  // Base note values (C = 0)
  const baseNotes: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11,
  }

  let pitchClass = baseNotes[noteLetter]
  if (pitchClass === undefined) {
    throw new Error(`Invalid note letter: ${noteLetter}`)
  }

  if (accidental === "#") {
    pitchClass = (pitchClass + 1) % 12
  } else if (accidental === "b") {
    pitchClass = (pitchClass + 11) % 12
  }

  // MIDI: C4 = 60
  return (octave + 1) * 12 + pitchClass
}

/**
 * Convert MIDI number to pitch class (0-11)
 */
function midiToPitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

/**
 * Get the note name from a pitch class
 */
function pitchClassToNoteName(pitchClass: number, preferFlats: boolean = false): string {
  const normalized = ((pitchClass % 12) + 12) % 12
  // normalized is always 0-11, so these accesses are safe
  const noteName = preferFlats ? FLAT_NOTE_NAMES[normalized] : NOTE_NAMES[normalized]
  return noteName as string
}

/**
 * Normalize input notes to pitch classes
 */
function normalizeNotes(notes: NoteInput[]): {
  pitchClasses: number[]
  lowestMidi: number
  lowestPitchClass: number
} {
  const midiNotes = notes.map((note) => {
    if (typeof note === "number") {
      return note
    }
    return parseNoteToMidi(note)
  })

  const lowestMidi = Math.min(...midiNotes)
  const lowestPitchClass = midiToPitchClass(lowestMidi)

  // Get unique pitch classes
  const pitchClassSet = new Set(midiNotes.map(midiToPitchClass))
  const pitchClasses = Array.from(pitchClassSet).sort((a, b) => a - b)

  return { pitchClasses, lowestMidi, lowestPitchClass }
}

/**
 * Calculate intervals from a given root to all pitch classes
 */
function calculateIntervals(pitchClasses: number[], root: number): number[] {
  return pitchClasses.map((pc) => (pc - root + 12) % 12)
}

/**
 * Check if a set of intervals matches a chord quality (allowing for omissions in extended chords)
 */
function matchChordQuality(
  inputIntervals: number[],
  qualityIntervals: number[],
): { matches: boolean; missingNotes: number[]; extraNotes: number[] } {
  // Normalize intervals to within octave for comparison (except for extensions)
  const normalizedInput = inputIntervals.map((i) => i % 12).sort((a, b) => a - b)
  const normalizedQuality = qualityIntervals.map((i) => i % 12).sort((a, b) => a - b)

  // Check for exact match
  const inputSet = new Set(normalizedInput)
  const qualitySet = new Set(normalizedQuality)

  const missingNotes = normalizedQuality.filter((i) => !inputSet.has(i))
  const extraNotes = normalizedInput.filter((i) => !qualitySet.has(i))

  // For basic triads and 7ths, require exact match
  if (qualityIntervals.length <= 4) {
    return {
      matches: missingNotes.length === 0 && extraNotes.length === 0,
      missingNotes,
      extraNotes,
    }
  }

  // For extended chords, allow omission of 5th (7) and sometimes the root in voicings
  // but require the defining tones (3rd, 7th, and the extension)
  const essentialTones: number[] = []
  const third = normalizedQuality[1]
  const seventh = normalizedQuality[3]
  const highestExtension = normalizedQuality[normalizedQuality.length - 1]

  if (third !== undefined) essentialTones.push(third)
  if (seventh !== undefined) essentialTones.push(seventh)
  if (highestExtension !== undefined && highestExtension !== seventh)
    essentialTones.push(highestExtension)

  const hasEssentialTones = essentialTones.every((tone) => inputSet.has(tone))

  return {
    matches: hasEssentialTones && extraNotes.length === 0 && missingNotes.length <= 2,
    missingNotes,
    extraNotes,
  }
}

/**
 * Determine if we should use flats based on the root note
 */
function shouldUseFlats(root: number): boolean {
  // Keys that traditionally use flats: F, Bb, Eb, Ab, Db, Gb
  const flatKeys = [5, 10, 3, 8, 1, 6]
  return flatKeys.includes(root)
}

/**
 * Score a chord match for ranking purposes
 */
function scoreChordMatch(
  quality: { intervals: number[]; name: string; priority: number },
  inputPitchClasses: number[],
  root: number,
  isInversion: boolean,
): number {
  let score = 100

  // Lower priority number = simpler chord = better score
  score -= quality.priority * 10

  // Penalize inversions slightly (root position is more common)
  if (isInversion) {
    score -= 5
  }

  // Bonus for having all notes match exactly
  const normalizedInput = inputPitchClasses.map((pc) => (pc - root + 12) % 12)
  const normalizedQuality = quality.intervals.map((i) => i % 12)

  if (normalizedInput.length === normalizedQuality.length) {
    score += 10
  }

  // Bonus for common chord types
  if (["", "m", "7", "m7", "maj7"].includes(quality.name)) {
    score += 5
  }

  return score
}

/**
 * Main function to identify chords from a set of notes
 * @param notes - Array of notes (as strings like "C4" or MIDI numbers)
 * @param maxResults - Maximum number of chord options to return (default 7)
 * @returns Array of possible chord interpretations
 */
export function identifyChords(notes: NoteInput[], maxResults: number = 7): ChordResult[] {
  if (notes.length < 3) {
    throw new Error("At least 3 notes are required to identify a chord")
  }

  const { pitchClasses, lowestPitchClass } = normalizeNotes(notes)
  const results: ChordCandidate[] = []

  // Try each pitch class as a potential root
  for (const potentialRoot of pitchClasses) {
    const intervals = calculateIntervals(pitchClasses, potentialRoot)
    const useFlats = shouldUseFlats(potentialRoot)
    const rootName = pitchClassToNoteName(potentialRoot, useFlats)

    // Check against each chord quality
    for (const [, quality] of Object.entries(CHORD_QUALITIES)) {
      const match = matchChordQuality(intervals, quality.intervals)

      if (match.matches) {
        const isInversion = potentialRoot !== lowestPitchClass
        const bassNote = isInversion ? pitchClassToNoteName(lowestPitchClass, useFlats) : null

        const chordName = bassNote
          ? `${rootName}${quality.name}/${bassNote}`
          : `${rootName}${quality.name}`

        const score = scoreChordMatch(quality, pitchClasses, potentialRoot, isInversion)

        results.push({
          name: chordName,
          root: rootName,
          quality: quality.name || "major",
          bassNote,
          intervals: intervals.sort((a, b) => a - b),
          isInversion,
          score,
        })
      }
    }
  }

  // Also check for slash chords where the bass note isn't part of the chord
  // This handles cases like C/G where G is in the bass but not the chord's own inversion
  for (const potentialRoot of pitchClasses) {
    const useFlats = shouldUseFlats(potentialRoot)
    const rootName = pitchClassToNoteName(potentialRoot, useFlats)

    // Get pitch classes excluding the lowest note
    const upperPitchClasses = pitchClasses.filter((pc) => pc !== lowestPitchClass)

    if (upperPitchClasses.length >= 2 && !upperPitchClasses.includes(lowestPitchClass)) {
      const intervals = calculateIntervals(upperPitchClasses, potentialRoot)

      for (const [, quality] of Object.entries(CHORD_QUALITIES)) {
        // Only check simpler chord types for slash chords
        if (quality.priority > 5) continue

        const match = matchChordQuality(intervals, quality.intervals)

        if (match.matches && potentialRoot !== lowestPitchClass) {
          const bassNote = pitchClassToNoteName(lowestPitchClass, useFlats)
          const chordName = `${rootName}${quality.name}/${bassNote}`

          // Check if we already have this chord
          const existingIndex = results.findIndex((r) => r.name === chordName)
          if (existingIndex === -1) {
            results.push({
              name: chordName,
              root: rootName,
              quality: quality.name || "major",
              bassNote,
              intervals: calculateIntervals(pitchClasses, potentialRoot).sort((a, b) => a - b),
              isInversion: true,
              score: scoreChordMatch(quality, pitchClasses, potentialRoot, true) - 3,
            })
          }
        }
      }
    }
  }

  // Sort by score (highest first) and remove duplicates
  const seen = new Set<string>()
  const uniqueResults = results
    .sort((a, b) => b.score - a.score)
    .filter((result) => {
      if (seen.has(result.name)) {
        return false
      }
      seen.add(result.name)
      return true
    })

  // Get top results without the score
  const topResults = uniqueResults.slice(0, maxResults).map(({ score: _score, ...rest }) => rest)

  // Add warnings to each chord result
  return topResults.map((chord) => {
    const warnings = generateChordWarnings(chord, topResults)
    const analysis = analyzeChord(chord)
    return {
      ...chord,
      analysis: analysis,
      warnings: warnings.length > 0 ? warnings : null,
    }
  })
}

// Export utility functions for external use
export { midiToPitchClass, parseNoteToMidi, pitchClassToNoteName }
export type { NoteName }
