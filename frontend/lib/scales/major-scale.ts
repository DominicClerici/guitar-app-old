"use client"

export {
  type ScaleNote,
  type CAGEDShapeName,
  MAJOR_SCALE_INTERVALS,
  CAGED_SHAPE_NAMES,
  getMajorScale,
  getCAGEDShapeNotes,
  getNoteName,
} from "@/lib/theory"

import { NOTE_NAMES } from "@/lib/theory"

export const ALL_KEYS = NOTE_NAMES.map((name, index) => ({
  name,
  noteIndex: index,
}))
