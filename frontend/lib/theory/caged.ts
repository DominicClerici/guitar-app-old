import { STANDARD_TUNING } from "./constants"
import type { CAGEDPosition, CAGEDShapeName, FretboardNote, NoteFormula, Tuning } from "./types"

const CAGED_POSITIONS: CAGEDPosition[] = [
  { name: "E", offsetFromLowERoot: [-1, 2], baseSemitones: 0 },
  { name: "G", offsetFromLowERoot: [-1, 3], baseSemitones: 3 },
  { name: "A", offsetFromLowERoot: [-1, 3], baseSemitones: 5 },
  { name: "C", offsetFromLowERoot: [-1, 3], baseSemitones: 8 },
  { name: "D", offsetFromLowERoot: [-1, 3], baseSemitones: 10 },
]

export const CAGED_SHAPE_NAMES: CAGEDShapeName[] = ["C", "A", "G", "E", "D"]

function getRootFretOnLowE(rootNoteIndex: number, tuning: Tuning = STANDARD_TUNING): number {
  const lowENote = tuning.stringNotes[0]
  return (rootNoteIndex - lowENote + 12) % 12
}

export function getCAGEDPosition(shapeName: CAGEDShapeName): CAGEDPosition | undefined {
  return CAGED_POSITIONS.find((p) => p.name === shapeName)
}

export function getCAGEDFretRange(
  shapeName: CAGEDShapeName,
  rootNoteIndex: number,
  tuning: Tuning = STANDARD_TUNING,
): { minFret: number; maxFret: number } | null {
  const position = getCAGEDPosition(shapeName)
  if (!position) return null

  const rootFret = getRootFretOnLowE(rootNoteIndex, tuning)
  const shapeOffset = position.baseSemitones

  let shapeLowERootFret = (rootFret + 12 - shapeOffset + 12) % 12
  if (shapeLowERootFret === 0 && shapeOffset > 0) {
    shapeLowERootFret = 12
  }

  return {
    minFret: Math.max(0, shapeLowERootFret + position.offsetFromLowERoot[0]),
    maxFret: shapeLowERootFret + position.offsetFromLowERoot[1],
  }
}

function getRelativeMajorRoot(rootNoteIndex: number, formula: NoteFormula): number {
  const isMajorBased =
    formula.category === "scale" && formula.id === "major" ||
    formula.category === "pentatonic" && formula.id === "majorPentatonic"

  if (isMajorBased) {
    return rootNoteIndex
  }

  // Minor scales/pentatonics: relative major is 3 semitones up
  return (rootNoteIndex + 3) % 12
}

export function getCAGEDShapeNotes<T extends FretboardNote>(
  shapeName: CAGEDShapeName,
  notes: T[],
  rootNoteIndex: number,
  tuning?: Tuning,
  formula?: NoteFormula,
): T[] {
  const relativeMajorRoot = formula
    ? getRelativeMajorRoot(rootNoteIndex, formula)
    : rootNoteIndex
  const range = getCAGEDFretRange(shapeName, relativeMajorRoot, tuning)
  if (!range) return []

  return notes.filter(
    (note) => note.fretIndex >= range.minFret && note.fretIndex <= range.maxFret,
  )
}

export function getAllCAGEDPositions(
  rootNoteIndex: number,
  tuning: Tuning = STANDARD_TUNING,
): Array<{ name: CAGEDShapeName; minFret: number; maxFret: number }> {
  return CAGED_SHAPE_NAMES.map((name) => {
    const range = getCAGEDFretRange(name, rootNoteIndex, tuning)
    return { name, minFret: range?.minFret ?? 0, maxFret: range?.maxFret ?? 0 }
  })
}
