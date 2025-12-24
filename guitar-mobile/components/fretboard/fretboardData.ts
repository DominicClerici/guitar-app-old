// Standard guitar tuning (low to high): E2, A2, D3, G3, B3, E4
// We represent strings from bottom (high E) to top (low E) for visual display

export const NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const

export type NoteName = (typeof NOTES)[number]

// Standard tuning - index 0 is the thickest string (low E), index 5 is thinnest (high E)
export const STANDARD_TUNING: NoteName[] = ["E", "A", "D", "G", "B", "E"]

// String names for display
export const STRING_NAMES = ["6th (E)", "5th (A)", "4th (D)", "3rd (G)", "2nd (B)", "1st (E)"]

// Number of frets to display (0 = open string, then frets 1-12)
export const FRET_COUNT = 12

// Frets that have single dot markers
export const SINGLE_DOT_FRETS = [3, 5, 7, 9]

// Frets that have double dot markers (12th fret = octave)
export const DOUBLE_DOT_FRETS = [12]

/**
 * Get the note at a specific string and fret position
 * @param stringIndex - 0 = low E (6th string), 5 = high E (1st string)
 * @param fret - 0 = open, 1-12 = fret number
 */
export function getNoteAtPosition(
  stringIndex: number,
  fret: number,
  tuning: NoteName[] = STANDARD_TUNING
): NoteName {
  const openNote = tuning[stringIndex]
  const openNoteIndex = NOTES.indexOf(openNote)
  const noteIndex = (openNoteIndex + fret) % 12
  return NOTES[noteIndex]
}

/**
 * Get all positions on the fretboard that match a specific note
 */
export function getPositionsForNote(
  note: NoteName,
  tuning: NoteName[] = STANDARD_TUNING,
  maxFret: number = FRET_COUNT
): Array<{ stringIndex: number; fret: number }> {
  const positions: Array<{ stringIndex: number; fret: number }> = []

  for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      if (getNoteAtPosition(stringIndex, fret, tuning) === note) {
        positions.push({ stringIndex, fret })
      }
    }
  }

  return positions
}

export interface FretPosition {
  stringIndex: number
  fret: number
  note: NoteName
}

/**
 * Generate all fret positions for the fretboard
 */
export function generateFretboardPositions(
  tuning: NoteName[] = STANDARD_TUNING,
  fretCount: number = FRET_COUNT
): FretPosition[] {
  const positions: FretPosition[] = []

  for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
    for (let fret = 0; fret <= fretCount; fret++) {
      positions.push({
        stringIndex,
        fret,
        note: getNoteAtPosition(stringIndex, fret, tuning),
      })
    }
  }

  return positions
}
