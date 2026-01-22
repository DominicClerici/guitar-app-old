export type FretboardNote = {
  fretIndex: number
  stringIndex: number
  noteIndex: number
  degree: number
  intervalName?: string
  isChordTone?: boolean
}

export type ScaleNote = FretboardNote

export type NoteFormula = {
  id: string
  name: string
  category: "scale" | "mode" | "arpeggio" | "pentatonic" | "blues"
  intervals: number[]
  chordTones?: number[]
  parentScale?: string
  modeNumber?: number
}

export type Tuning = {
  name: string
  stringNotes: number[]
}

export type CAGEDShapeName = "C" | "A" | "G" | "E" | "D"

export type CAGEDPosition = {
  name: CAGEDShapeName
  offsetFromLowERoot: [number, number]
  baseSemitones: number
}

export type NoteFilter = {
  rootOnly?: boolean
  chordTonesOnly?: boolean
  fretRange?: { min: number; max: number }
  stringRange?: { min: number; max: number }
  degrees?: number[]
}
