import { STRING_OPEN_MIDI } from "@/lib/audio/utils"
import type { FretboardNote } from "@/lib/theory"

export function getMidiForPosition(stringIndex: number, fretIndex: number) {
  return STRING_OPEN_MIDI[stringIndex] + fretIndex
}

export function getRandomKeyExcluding(excludedKeys: number[], totalKeys = 12) {
  const availableKeys = Array.from({ length: totalKeys }, (_, i) => i).filter(
    (key) => !excludedKeys.includes(key),
  )
  if (availableKeys.length === 0) return 0
  return availableKeys[Math.floor(Math.random() * availableKeys.length)]
}

export function doesMidiMatchAnyNote(midi: number, notes: FretboardNote[]) {
  return notes.some((note) => getMidiForPosition(note.stringIndex, note.fretIndex) === midi)
}

export function findMatchingNotes(midi: number, notes: FretboardNote[]) {
  return notes.filter((note) => getMidiForPosition(note.stringIndex, note.fretIndex) === midi)
}

export function createNoteKey(stringIndex: number, fretIndex: number) {
  return `${stringIndex}-${fretIndex}`
}
