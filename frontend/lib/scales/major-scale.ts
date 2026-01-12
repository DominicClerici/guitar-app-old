import { midiToFreq, NOTE_NAMES } from "@/lib/audio/utils"

export type ScaleNote = {
  fretIndex: number
  stringIndex: number
  noteIndex: number
  degree: number
  targetFrequency: number
}

const STRING_OPEN_NOTES = [4, 9, 2, 7, 11, 4]
const STRING_OPEN_MIDI = [40, 45, 50, 55, 59, 64]

function getFrequencyFromPosition(stringIndex: number, fretIndex: number): number {
  return midiToFreq(STRING_OPEN_MIDI[stringIndex] + fretIndex)
}

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
          targetFrequency: getFrequencyFromPosition(stringIndex, fretIndex),
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
    ? scale.map((note) => {
        const newFretIndex = note.fretIndex >= 13 ? note.fretIndex - 12 : note.fretIndex
        return {
          ...note,
          fretIndex: newFretIndex,
          targetFrequency: getFrequencyFromPosition(note.stringIndex, newFretIndex),
        }
      })
    : scale

  return wrappedScale.filter((note) => note.fretIndex >= startFret && note.fretIndex <= endFret)
}

export function transposeScale(scale: ScaleNote[], semitones: number): ScaleNote[] {
  const shift = ((semitones % 12) + 12) % 12

  return scale.map((note) => {
    const newFretIndex = note.fretIndex + shift
    return {
      ...note,
      fretIndex: newFretIndex,
      noteIndex: (note.noteIndex + shift) % 12,
      targetFrequency: getFrequencyFromPosition(note.stringIndex, newFretIndex),
    }
  })
}

export function getSemitoneShift(targetRoot: number): number {
  const A_INDEX = 9
  return (((targetRoot - A_INDEX) % 12) + 12) % 12
}

export function getMajorScale(rootNoteIndex: number): ScaleNote[] {
  const shift = getSemitoneShift(rootNoteIndex)
  return transposeScale(A_MAJOR_SCALE, shift)
}

function applyModeTransform(scale: ScaleNote[], lowerDegrees: number[], raiseDegrees: number[] = []): ScaleNote[] {
  return scale.map((note) => {
    let shift = 0
    if (lowerDegrees.includes(note.degree)) shift = -1
    else if (raiseDegrees.includes(note.degree)) shift = 1
    if (shift === 0) return note
    const newFretIndex = note.fretIndex + shift
    return {
      ...note,
      fretIndex: newFretIndex,
      noteIndex: (note.noteIndex + shift + 12) % 12,
      targetFrequency: midiToFreq(STRING_OPEN_MIDI[note.stringIndex] + newFretIndex),
    }
  })
}

export function convertToMinor(scale: ScaleNote[]): ScaleNote[] {
  return applyModeTransform(scale, [3, 6, 7])
}

export function convertToDorian(scale: ScaleNote[]): ScaleNote[] {
  return applyModeTransform(scale, [3, 7])
}

export function convertToPhrygian(scale: ScaleNote[]): ScaleNote[] {
  return applyModeTransform(scale, [2, 3, 6, 7])
}

export function convertToLydian(scale: ScaleNote[]): ScaleNote[] {
  return applyModeTransform(scale, [], [4])
}

export function convertToMixolydian(scale: ScaleNote[]): ScaleNote[] {
  return applyModeTransform(scale, [7])
}

export function convertToAeolian(scale: ScaleNote[]): ScaleNote[] {
  return applyModeTransform(scale, [3, 6, 7])
}

export function convertToLocrian(scale: ScaleNote[]): ScaleNote[] {
  return applyModeTransform(scale, [2, 3, 5, 6, 7])
}

export function convertToMajorPentatonic(scale: ScaleNote[]): ScaleNote[] {
  return scale.filter((note) => note.degree !== 4 && note.degree !== 7)
}

export function convertToMinorPentatonic(scale: ScaleNote[]): ScaleNote[] {
  return convertToMinor(scale).filter((note) => note.degree !== 2 && note.degree !== 6)
}

export type FretPosition = {
  stringIndex: number
  fretIndex: number
}

const STRING_COUNT = 6
const MAX_FRET_FOR_DETECTION = 18

export function findAllFretPositionsForMidi(midi: number): FretPosition[] {
  const positions: FretPosition[] = []
  for (let stringIndex = 0; stringIndex < STRING_COUNT; stringIndex++) {
    const fretIndex = midi - STRING_OPEN_MIDI[stringIndex]
    if (fretIndex >= 0 && fretIndex <= MAX_FRET_FOR_DETECTION) {
      positions.push({ stringIndex, fretIndex })
    }
  }
  return positions
}

function getDistance(a: FretPosition, b: FretPosition): number {
  return Math.abs(a.stringIndex - b.stringIndex) + Math.abs(a.fretIndex - b.fretIndex)
}

export function findBestFretPosition(
  midi: number,
  scaleNotes: ScaleNote[],
  playedNoteKeys: Set<string>,
): FretPosition | null {
  const candidates = findAllFretPositionsForMidi(midi)
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  let bestCandidates = candidates
  let minDistance = Infinity
  for (const candidate of candidates) {
    for (const scaleNote of scaleNotes) {
      const dist = getDistance(candidate, scaleNote)
      if (dist < minDistance) {
        minDistance = dist
        bestCandidates = [candidate]
      } else if (dist === minDistance && !bestCandidates.includes(candidate)) {
        bestCandidates.push(candidate)
      }
    }
  }

  if (bestCandidates.length === 1) return bestCandidates[0]

  const unplayedScaleNotes = scaleNotes.filter(
    (note) => !playedNoteKeys.has(`${note.stringIndex}-${note.fretIndex}`),
  )

  if (unplayedScaleNotes.length > 0) {
    let narrowed = bestCandidates
    minDistance = Infinity
    for (const candidate of bestCandidates) {
      for (const unplayedNote of unplayedScaleNotes) {
        const dist = getDistance(candidate, unplayedNote)
        if (dist < minDistance) {
          minDistance = dist
          narrowed = [candidate]
        } else if (dist === minDistance && !narrowed.includes(candidate)) {
          narrowed.push(candidate)
        }
      }
    }
    bestCandidates = narrowed
  }

  if (bestCandidates.length === 1) return bestCandidates[0]

  return bestCandidates.reduce((best, curr) => (curr.fretIndex > best.fretIndex ? curr : best))
}
