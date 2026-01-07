import { NOTE_NAMES } from "@/lib/audio/utils"

/**
 * Scale note position on the fretboard
 */
export type ScaleNote = {
  fretIndex: number // 1-12 (fret position)
  stringIndex: number // 0-5 (0 = low E, 5 = high E)
  noteIndex: number // 0-11 (index in NOTE_NAMES: C=0, C#=1, D=2, etc.)
  degree: number // 1-7 (scale degree)
}

/**
 * Standard guitar tuning: E A D G B E (low to high)
 * String indices: 0=E2, 1=A2, 2=D3, 3=G3, 4=B3, 5=E4
 * Open string note indices in NOTE_NAMES:
 * E=4, A=9, D=2, G=7, B=11, E=4
 */
const STRING_OPEN_NOTES = [4, 9, 2, 7, 11, 4] // E, A, D, G, B, E

/**
 * A Major Scale notes: A, B, C#, D, E, F#, G#
 * Note indices in NOTE_NAMES: A=9, B=11, C#=1, D=2, E=4, F#=6, G#=8
 * Degrees: A=1, B=2, C#=3, D=4, E=5, F#=6, G#=7
 */
const A_MAJOR_NOTES: Record<number, number> = {
  9: 1, // A = degree 1 (root)
  11: 2, // B = degree 2
  1: 3, // C# = degree 3
  2: 4, // D = degree 4
  4: 5, // E = degree 5
  6: 6, // F# = degree 6
  8: 7, // G# = degree 7
}

/**
 * Major scale interval pattern (in semitones from root): W W H W W W H
 * 0, 2, 4, 5, 7, 9, 11 semitones
 */
export const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]

/**
 * Get the note index at a specific fret on a specific string
 */
function getNoteAtFret(stringIndex: number, fretIndex: number): number {
  return (STRING_OPEN_NOTES[stringIndex] + fretIndex) % 12
}

/**
 * A Major Scale - All positions from frets 1-12
 * Built by checking each fret/string combination and including those
 * that are part of the A major scale.
 *
 * From the reference image, the A major scale positions are:
 * - Root notes (A, degree 1) are at specific positions marked darker
 * - The scale follows the pattern across all 6 strings
 */
export const A_MAJOR_SCALE: ScaleNote[] = (() => {
  const notes: ScaleNote[] = []

  // Iterate through all frets 1-12 on all 6 strings
  for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
    for (let fretIndex = 1; fretIndex <= 12; fretIndex++) {
      const noteIndex = getNoteAtFret(stringIndex, fretIndex)
      const degree = A_MAJOR_NOTES[noteIndex]

      // Only include if this note is part of the A major scale
      if (degree !== undefined) {
        notes.push({
          fretIndex,
          stringIndex,
          noteIndex,
          degree,
        })
      }
    }
  }
  return notes
})()

/**
 * The 5 CAGED system shape definitions with their fret ranges
 * These ranges define which portion of the fretboard each shape covers
 *
 * For A major (root on fret 5 of low E string):
 * - Shape 1 (G shape): frets 1-5 - starts from open/nut area
 * - Shape 2 (E shape): frets 4-7 - overlaps with previous, centered around fret 5
 * - Shape 3 (D shape): frets 7-10 - middle of the neck
 * - Shape 4 (C shape): frets 9-12 - higher up the neck
 * - Shape 5 (A shape): frets 11-15 - wraps around to fret 12 (octave)
 */
export const CAGED_SHAPE_RANGES = [
  { name: "G shape", startFret: 1, endFret: 5 },
  { name: "E shape", startFret: 4, endFret: 7 },
  { name: "D shape", startFret: 7, endFret: 10 },
  { name: "C shape", startFret: 9, endFret: 12 },
  { name: "A shape", startFret: 11, endFret: 15 },
] as const

export type CAGEDShapeName = (typeof CAGED_SHAPE_RANGES)[number]["name"]

/**
 * Get scale notes for a specific CAGED shape
 * Filters the full A_MAJOR_SCALE to only include notes within the shape's fret range
 */
export function getShapeNotes(shapeIndex: number, scale: ScaleNote[] = A_MAJOR_SCALE): ScaleNote[] {
  const shape = CAGED_SHAPE_RANGES[shapeIndex]
  if (!shape) return []

  return scale.filter((note) => {
    // Handle frets that go beyond 12 by using modulo
    let fret = note.fretIndex
    if (shape.endFret > 12) {
      // For shapes that wrap around (like 11-15), include notes from frets 1-3 as 13-15
      if (fret >= shape.startFret && fret <= 12) return true
      if (fret >= 1 && fret <= shape.endFret - 12) {
        return true
      }
      return false
    }
    return fret >= shape.startFret && fret <= shape.endFret
  })
}

/**
 * Transpose a scale to a different key
 * @param scale - The base scale (e.g., A_MAJOR_SCALE)
 * @param semitones - Number of semitones to shift (positive = up, negative = down)
 * @returns New scale with adjusted fret positions
 *
 * Example: To get B major from A major, shift by +2 semitones
 * Example: To get G major from A major, shift by -2 semitones (or +10)
 */
export function transposeScale(scale: ScaleNote[], semitones: number): ScaleNote[] {
  // Normalize semitones to positive value 0-11
  const shift = ((semitones % 12) + 12) % 12

  const scaled = scale.map((note) => {
    let newFret = note.fretIndex + shift
    // Wrap around if fret goes beyond 12
    if (newFret > 12) {
      newFret = newFret - 12
    }
    // Handle edge case where shifting down wraps around
    if (newFret < 1) {
      newFret = newFret + 12
    }

    return {
      ...note,
      fretIndex: newFret,
      noteIndex: (note.noteIndex + shift) % 12,
    }
  })

  return scaled
}

/**
 * Get the semitone shift needed to transpose from A to a target key
 * @param targetRoot - The note index of the target key's root (0-11)
 * @returns Number of semitones to shift
 */
export function getSemitoneShift(targetRoot: number): number {
  // A is at index 9 in NOTE_NAMES
  const A_INDEX = 9
  return (((targetRoot - A_INDEX) % 12) + 12) % 12
}

/**
 * Get scale for any major key
 * @param rootNoteIndex - The note index of the root (0-11, where C=0, A=9, etc.)
 */
export function getMajorScale(rootNoteIndex: number): ScaleNote[] {
  const shift = getSemitoneShift(rootNoteIndex)
  return transposeScale(A_MAJOR_SCALE, shift)
}

/**
 * Get the note name for display
 */
export function getNoteName(noteIndex: number): string {
  return NOTE_NAMES[noteIndex]
}

/**
 * Convert shape notes to fretboard markers format
 * Handles wrapping for shapes that extend beyond fret 12
 */
export function getShapeNotesWithWrapping(
  shapeIndex: number,
  scale: ScaleNote[] = A_MAJOR_SCALE,
): ScaleNote[] {
  const shape = CAGED_SHAPE_RANGES[shapeIndex]
  if (!shape) return []

  const notes: ScaleNote[] = []

  // Get notes in the main range (up to fret 12)
  for (const note of scale) {
    if (note.fretIndex >= shape.startFret && note.fretIndex <= Math.min(shape.endFret, 12)) {
      notes.push(note)
    }
  }

  // If shape extends beyond 12, add wrapped notes (frets 13-15 = frets 1-3)
  if (shape.endFret > 12) {
    const wrapEnd = shape.endFret - 12
    for (const note of scale) {
      if (note.fretIndex >= 1 && note.fretIndex <= wrapEnd) {
        // Add as a new note with adjusted fret index for display
        notes.push({
          ...note,
          fretIndex: note.fretIndex + 12, // Display as fret 13, 14, 15
        })
      }
    }
  }

  return notes
}
