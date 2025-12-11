import { useMemo } from "react"
import { detect } from "@tonaljs/chord-detect"
import useFretboardContext from "./fretboard-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Standard tuning MIDI notes: String 0 is high E (E4), String 5 is low E (E2)
const STANDARD_TUNING_MIDI = [64, 59, 55, 50, 45, 40] // E4, B3, G3, D3, A2, E2

// Note names in chromatic order
const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
]

// Convert MIDI note number to note name (e.g., 64 -> "E")
// Uses floor to handle half-step tunings: -0.5 goes down, +0.5 stays same
function midiToNoteName(midi: number): string {
  const noteIndex = ((midi % 12) + 12) % 12 // Handle negative values
  return NOTE_NAMES[noteIndex]
}

// Convert MIDI note number to note name with octave (e.g., 64 -> "E4")
// Uses floor to handle half-step tunings: -0.5 goes down, +0.5 stays same
function midiToNoteNameWithOctave(midi: number): string {
  const flooredMidi = Math.floor(midi)
  const noteIndex = ((flooredMidi % 12) + 12) % 12 // Handle negative values
  const octave = Math.floor(flooredMidi / 12) - 1
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

export default function FretboardChords() {
  const { fretPositions, tuning } = useFretboardContext()

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
      if (fret === -1) continue // Skip strings with no note

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

  // Detect possible chords from the active notes
  const detectedChords = useMemo(() => {
    if (activeNotes.length < 2) return []

    // Get unique note names (without octave) for chord detection
    const noteNames = [...new Set(activeNotes.map((n) => n.noteName))]

    // Use tonal.js chord detection
    const chords = detect(noteNames)

    return chords
  }, [activeNotes])

  // Get note names for display
  const noteNamesDisplay = activeNotes.map((n) => n.noteWithOctave).join(", ")

  return (
    <Card>
      <h3 className="font-semibold text-xl">Chords</h3>
      <div>
        {activeNotes.length === 0 ? (
          <p className="text-muted-foreground">No notes selected</p>
        ) : (
          <>
            <div className="mb-1">
              <span className="text-sm font-medium text-muted-foreground">
                Notes:{" "}
              </span>
              <span className="text-sm font-mono">{noteNamesDisplay}</span>
            </div>

            {activeNotes.length < 2 ? (
              <p className="text-muted-foreground text-sm">
                Select at least 2 notes
              </p>
            ) : detectedChords.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No matching chords found
              </p>
            ) : (
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Possible chords:
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detectedChords.map((chord, index) => (
                    <span
                      key={index}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        index === 0
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {chord}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
