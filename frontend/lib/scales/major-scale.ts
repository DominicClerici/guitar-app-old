"use client"

import { NOTE_NAMES } from "@/lib/audio/utils"

export type ScaleNote = {
  fretIndex: number
  stringIndex: number
  noteIndex: number
  degree: number
}

const STRING_OPEN_NOTES = [4, 9, 2, 7, 11, 4] // E, A, D, G, B, E as note indices

export const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]

function getNoteAtFret(stringIndex: number, fretIndex: number): number {
  return (STRING_OPEN_NOTES[stringIndex] + fretIndex) % 12
}

function buildScaleNotesLookup(rootNoteIndex: number): Record<number, number> {
  const lookup: Record<number, number> = {}
  MAJOR_SCALE_INTERVALS.forEach((interval, index) => {
    const noteIndex = (rootNoteIndex + interval) % 12
    lookup[noteIndex] = index + 1 // degree is 1-indexed
  })
  return lookup
}

const MAX_FRET = 18

export function getMajorScale(rootNoteIndex: number): ScaleNote[] {
  const scaleNotesLookup = buildScaleNotesLookup(rootNoteIndex)
  const notes: ScaleNote[] = []

  for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
    for (let fretIndex = 0; fretIndex <= MAX_FRET; fretIndex++) {
      const noteIndex = getNoteAtFret(stringIndex, fretIndex)
      const degree = scaleNotesLookup[noteIndex]

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
}

export function getNoteName(noteIndex: number): string {
  return NOTE_NAMES[noteIndex]
}

export const ALL_KEYS = NOTE_NAMES.map((name, index) => ({
  name,
  noteIndex: index,
}))
