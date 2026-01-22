import { MAX_FRET, NOTE_NAMES, STANDARD_TUNING } from "./constants"
import { getIntervalName } from "./intervals"
import { SCALE_FORMULAS } from "./scales"
import type { FretboardNote, NoteFormula, Tuning } from "./types"

export function getNoteAtFret(
  stringIndex: number,
  fretIndex: number,
  tuning: Tuning = STANDARD_TUNING,
): number {
  return (tuning.stringNotes[stringIndex] + fretIndex) % 12
}

export function getNoteName(noteIndex: number): string {
  return NOTE_NAMES[noteIndex]
}

function buildNoteLookup(
  rootNoteIndex: number,
  formula: NoteFormula,
): Map<number, { degree: number; intervalIndex: number; isChordTone: boolean }> {
  const lookup = new Map<
    number,
    { degree: number; intervalIndex: number; isChordTone: boolean }
  >()

  formula.intervals.forEach((interval, index) => {
    const noteIndex = (rootNoteIndex + interval) % 12
    lookup.set(noteIndex, {
      degree: index + 1,
      intervalIndex: index,
      isChordTone: formula.chordTones?.includes(index) ?? false,
    })
  })

  return lookup
}

export function generateFretboardNotes(
  rootNoteIndex: number,
  formula: NoteFormula,
  options: {
    tuning?: Tuning
    maxFret?: number
  } = {},
): FretboardNote[] {
  const { tuning = STANDARD_TUNING, maxFret = MAX_FRET } = options
  const lookup = buildNoteLookup(rootNoteIndex, formula)
  const notes: FretboardNote[] = []

  for (let stringIndex = 0; stringIndex < tuning.stringNotes.length; stringIndex++) {
    for (let fretIndex = 0; fretIndex <= maxFret; fretIndex++) {
      const noteIndex = getNoteAtFret(stringIndex, fretIndex, tuning)
      const noteInfo = lookup.get(noteIndex)

      if (noteInfo) {
        const semitones = formula.intervals[noteInfo.intervalIndex]
        notes.push({
          fretIndex,
          stringIndex,
          noteIndex,
          degree: noteInfo.degree,
          intervalName: getIntervalName(semitones),
          isChordTone: noteInfo.isChordTone,
        })
      }
    }
  }

  return notes
}

export function getMajorScale(rootNoteIndex: number): FretboardNote[] {
  return generateFretboardNotes(rootNoteIndex, SCALE_FORMULAS.major)
}
