"use client"

export {
  CAGED_SHAPE_NAMES,
  getCAGEDShapeNotes,
  getMajorScale,
  getNoteName,
  MAJOR_SCALE_INTERVALS,
  type CAGEDShapeName,
  type ScaleNote,
} from "@/lib/theory"

import { NOTE_NAMES } from "@/lib/theory"

export const ALL_KEYS = NOTE_NAMES.map((name, index) => ({
  name,
  noteIndex: index,
}))
