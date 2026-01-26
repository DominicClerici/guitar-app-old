import type { FretboardNote, NoteFilter } from "./types"

export function filterNotes<T extends FretboardNote>(notes: T[], filter: NoteFilter): T[] {
  return notes.filter((note) => {
    if (filter.rootOnly && note.degree !== 1) return false

    if (filter.chordTonesOnly && !note.isChordTone) return false

    if (filter.fretRange) {
      if (note.fretIndex < filter.fretRange.min) return false
      if (note.fretIndex > filter.fretRange.max) return false
    }

    if (filter.stringRange) {
      if (note.stringIndex < filter.stringRange.min) return false
      if (note.stringIndex > filter.stringRange.max) return false
    }

    if (filter.degrees && !filter.degrees.includes(note.degree)) return false

    return true
  })
}

export function getRootNotes<T extends FretboardNote>(notes: T[]): T[] {
  return filterNotes(notes, { rootOnly: true })
}

export function getChordTones<T extends FretboardNote>(notes: T[]): T[] {
  return filterNotes(notes, { chordTonesOnly: true })
}

export function getNotesInFretRange<T extends FretboardNote>(
  notes: T[],
  min: number,
  max: number,
): T[] {
  return filterNotes(notes, { fretRange: { min, max } })
}

export function getNotesByDegrees<T extends FretboardNote>(notes: T[], degrees: number[]): T[] {
  return filterNotes(notes, { degrees })
}
