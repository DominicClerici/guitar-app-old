import { detect } from "@tonaljs/chord-detect"
import { useMemo } from "react"
import { FretPositions } from "../context/tab-fret-context"
import { Tuning } from "../context/tab-tuning-context"

// Standard tuning MIDI notes: String 0 is high E (E4), String 5 is low E (E2)
const STANDARD_TUNING_MIDI = [64, 59, 55, 50, 45, 40] // E4, B3, G3, D3, A2, E2

// Note names in chromatic order
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

// Convert MIDI note number to note name (e.g., 64 -> "E")
function midiToNoteName(midi: number): string {
  const noteIndex = ((Math.floor(midi) % 12) + 12) % 12
  return NOTE_NAMES[noteIndex]
}

// Convert MIDI note number to note name with octave (e.g., 64 -> "E4")
function midiToNoteNameWithOctave(midi: number): string {
  const flooredMidi = Math.floor(midi)
  const noteIndex = ((flooredMidi % 12) + 12) % 12
  const octave = Math.floor(flooredMidi / 12) - 1
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

interface TabEditorChordsProps {
  fretPositions: FretPositions
  tuning: Tuning
}

export default function TabEditorChords({ fretPositions, tuning }: TabEditorChordsProps) {
  // Calculate the actual notes being played
  const activeNotes = useMemo(() => {
    const notes: {
      noteName: string
      noteWithOctave: string
      midi: number
      string: number
    }[] = []

    for (let string = 0; string < 6; string++) {
      const fret = fretPositions[string]
      if (fret === -1) continue // Skip muted strings

      // Calculate MIDI note: base tuning + tuning offset + fret position
      const baseMidi = STANDARD_TUNING_MIDI[string]
      const tuningOffset = tuning[string]
      const midiNote = baseMidi + tuningOffset + fret

      notes.push({
        noteName: midiToNoteName(midiNote),
        noteWithOctave: midiToNoteNameWithOctave(midiNote),
        midi: midiNote,
        string,
      })
    }

    return notes
  }, [fretPositions, tuning])

  // Get unique note names for chord detection
  const noteNames = useMemo(() => {
    return [...new Set(activeNotes.map((n) => n.noteName))]
  }, [activeNotes])

  // Detect chords using @tonaljs/chord-detect
  const chordDetectResults = useMemo(() => {
    if (noteNames.length < 2) return []
    const detectedChords = [
      ...detect(noteNames),
      ...detect(noteNames, { assumePerfectFifth: true }),
    ]
    // Remove duplicates but keep order
    return detectedChords.filter((chord, index) => detectedChords.indexOf(chord) === index)
  }, [noteNames])

  // Get note names for display
  const noteNamesDisplay = activeNotes.map((n) => n.noteWithOctave).join(", ")

  return (
    <>
      <div>
        {activeNotes.length === 0 ? (
          <p className="text-muted-foreground">No notes selected</p>
        ) : (
          <>
            <div className="mb-3">
              <span className="text-muted-foreground text-sm font-medium">Notes: </span>
              <span className="font-mono text-sm">{noteNamesDisplay}</span>
            </div>

            {activeNotes.length < 2 ? (
              <p className="text-muted-foreground text-sm">Select at least 2 notes</p>
            ) : (
              <div className="space-y-4">
                {/* @tonaljs/chord-detect results */}
                <div>
                  <span className="text-muted-foreground text-sm font-medium">
                    @tonaljs/chord-detect:
                  </span>
                  {chordDetectResults.length === 0 ? (
                    <p className="text-muted-foreground mt-1 text-sm">No matching chords found</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {chordDetectResults.map((chord, index) => (
                        <span
                          key={index}
                          className={`rounded-full px-3 py-1 text-sm font-medium ${
                            index === 0
                              ? "bg-blue-500 text-white"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          }`}
                        >
                          {chord}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
