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

// CAGED Shape System
// Each shape has a fixed position relative to the root note on the low E string.
// The shapes cycle in the order C-A-G-E-D as you move up the neck.

export type CAGEDShapeName = "C" | "A" | "G" | "E" | "D"

// For the key of E (open position), here's where each shape falls:
// E shape: frets 0-4 (open position, root on fret 0 of low E)
// G shape: frets 2-6 (root on fret 3 of low E... wait, that's G#)
//
// Actually, the correct way to think about this:
// In any key, the root appears on the low E string at a specific fret.
// The 5 shapes then appear in sequence: the shape whose NAME matches where
// the root would be in open position for that chord.
//
// For key of C: root on low E at fret 8
//   - C shape starts around fret 7-8 (root at fret 8)
//   - A shape is next, around fret 10-12
//   - G shape around fret 12-15
//   - E shape around fret 0-3 (wraps/repeats)
//   - D shape around fret 2-5
//
// The key insight: each shape is defined by where the LOW E STRING ROOT falls
// within that shape's "box". Each shape has the root at a different relative
// position within its 4-5 fret span.

// Shape definitions based on the position of the root on string 0 (low E)
// within the shape's fret range. offsetFromRoot is [fretsBefore, fretsAfter]
// relative to the low E root position.
type ShapeConfig = {
  name: CAGEDShapeName
  // How many frets before and after the low E string root this shape spans
  offsetFromLowERoot: [number, number]
  // Semitones above E (note index 4) where this shape's low E root sits in open position
  // E=0, F=1, F#=2, G=3, G#=4, A=5, etc. (relative to E)
  baseSemitones: number
}

// These are calibrated for standard CAGED positions
// baseSemitones indicates where each shape "starts" relative to E
const SHAPE_CONFIGS: ShapeConfig[] = [
  { name: "E", offsetFromLowERoot: [-1, 2], baseSemitones: 0 },
  { name: "G", offsetFromLowERoot: [-1, 3], baseSemitones: 3 },
  { name: "A", offsetFromLowERoot: [-1, 3], baseSemitones: 5 },
  { name: "C", offsetFromLowERoot: [-1, 3], baseSemitones: 8 },
  { name: "D", offsetFromLowERoot: [-1, 3], baseSemitones: 10 },
]

function getRootFretOnLowE(rootNoteIndex: number): number {
  // Low E string is note index 4
  const lowENote = 4
  return (rootNoteIndex - lowENote + 12) % 12
}

export function getCAGEDShapeNotes(
  shapeName: CAGEDShapeName,
  fullScale: ScaleNote[],
  rootNoteIndex: number,
): ScaleNote[] {
  const config = SHAPE_CONFIGS.find((c) => c.name === shapeName)
  if (!config) return []

  // Find where the root is on the low E string (first occurrence)
  const rootFret = getRootFretOnLowE(rootNoteIndex)

  // Calculate how far this shape is shifted from the E shape
  // E shape has root at fret 0 for key of E
  // Each shape starts at a different position in the cycle
  const shapeOffset = config.baseSemitones

  // The shape's root position on low E for this key
  // This is where the root falls WITHIN this shape's pattern
  let shapeLowERootFret = (rootFret + 12 - shapeOffset + 12) % 12
  if (shapeLowERootFret === 0 && shapeOffset > 0) {
    shapeLowERootFret = 12
  }

  // Calculate the fret range for this shape
  const minFret = Math.max(0, shapeLowERootFret + config.offsetFromLowERoot[0])
  const maxFret = shapeLowERootFret + config.offsetFromLowERoot[1]

  return fullScale.filter((note) => note.fretIndex >= minFret && note.fretIndex <= maxFret)
}

export const CAGED_SHAPE_NAMES: CAGEDShapeName[] = ["C", "A", "G", "E", "D"]
