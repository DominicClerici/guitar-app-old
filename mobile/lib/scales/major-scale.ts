import { NOTE_NAMES } from "@/lib/audio/utils"

export type ScaleNote = {
  fretIndex: number
  stringIndex: number
  noteIndex: number
  degree: number
}

const STRING_OPEN_NOTES = [4, 9, 2, 7, 11, 4]

const A_MAJOR_NOTES: Record<number, number> = {
  9: 1,
  11: 2,
  1: 3,
  2: 4,
  4: 5,
  6: 6,
  8: 7,
}

export const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]

function getNoteAtFret(stringIndex: number, fretIndex: number): number {
  return (STRING_OPEN_NOTES[stringIndex] + fretIndex) % 12
}

const MAX_FRET = 24

export const A_MAJOR_SCALE: ScaleNote[] = (() => {
  const notes: ScaleNote[] = []

  for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
    for (let fretIndex = 1; fretIndex <= MAX_FRET; fretIndex++) {
      const noteIndex = getNoteAtFret(stringIndex, fretIndex)
      const degree = A_MAJOR_NOTES[noteIndex]

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

export const CAGED_SHAPE_RANGES = [
  { name: "G shape", startFret: 1, endFret: 5 },
  { name: "E shape", startFret: 4, endFret: 7 },
  { name: "D shape", startFret: 7, endFret: 11 },
  { name: "C shape", startFret: 9, endFret: 12 },
  { name: "A shape", startFret: 11, endFret: 15 },
] as const

export type CAGEDShapeName = (typeof CAGED_SHAPE_RANGES)[number]["name"]

export function getShapeNotes(shapeIndex: number, scale: ScaleNote[] = A_MAJOR_SCALE): ScaleNote[] {
  const shape = CAGED_SHAPE_RANGES[shapeIndex]
  if (!shape) return []

  const scaleMinFret = Math.min(...scale.map((n) => n.fretIndex))
  const offset = scaleMinFret - 1

  let startFret = shape.startFret + offset
  let endFret = shape.endFret + offset

  const shouldWrapShape = startFret >= 13
  if (shouldWrapShape) {
    startFret -= 12
    endFret -= 12
  }

  const wrappedScale = shouldWrapShape
    ? scale.map((note) => ({
        ...note,
        fretIndex: note.fretIndex >= 13 ? note.fretIndex - 12 : note.fretIndex,
      }))
    : scale

  return wrappedScale.filter((note) => note.fretIndex >= startFret && note.fretIndex <= endFret)
}

export function transposeScale(scale: ScaleNote[], semitones: number): ScaleNote[] {
  const shift = ((semitones % 12) + 12) % 12

  return scale.map((note) => ({
    ...note,
    fretIndex: note.fretIndex + shift,
    noteIndex: (note.noteIndex + shift) % 12,
  }))
}

export function getSemitoneShift(targetRoot: number): number {
  const A_INDEX = 9
  return (((targetRoot - A_INDEX) % 12) + 12) % 12
}

export function getMajorScale(rootNoteIndex: number): ScaleNote[] {
  const shift = getSemitoneShift(rootNoteIndex)
  return transposeScale(A_MAJOR_SCALE, shift)
}

export function getNoteName(noteIndex: number): string {
  return NOTE_NAMES[noteIndex]
}
