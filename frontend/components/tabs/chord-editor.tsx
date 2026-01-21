"use client"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import { Button } from "@/components/ui/button"
import useTabs, { type ChordNote, type GuitarInstrumentId } from "@/context/tabs-provider"
import { getNoteLabel, getNoteName } from "@/lib/audio/guitar-notes"
import { useCallback, useState } from "react"
import * as Tone from "tone"

type ChordEditorProps = {
  instrumentId: GuitarInstrumentId
}

export function ChordEditor({ instrumentId }: ChordEditorProps) {
  const { getLoadingState, playNote, strumChord, addChordToLine, isPlaying } = useTabs()
  const [chordNotes, setChordNotes] = useState<ChordNote[]>([])
  const [isStrumming, setIsStrumming] = useState(false)

  const loadingState = getLoadingState(instrumentId)
  const isReady = loadingState === "loaded"

  const handleFretClick = useCallback(
    async (stringIndex: number, fretIndex: number) => {
      if (!isReady) return

      await Tone.start()

      const existingNoteIndex = chordNotes.findIndex(
        (n) => n.stringIndex === stringIndex && n.fret === fretIndex,
      )

      if (existingNoteIndex !== -1) {
        setChordNotes((prev) => prev.filter((_, i) => i !== existingNoteIndex))
        return
      }

      const existingOnString = chordNotes.findIndex((n) => n.stringIndex === stringIndex)
      if (existingOnString !== -1) {
        setChordNotes((prev) => prev.filter((_, i) => i !== existingOnString))
      }

      setChordNotes((prev) => [...prev, { stringIndex, fret: fretIndex }])

      const noteName = getNoteName(stringIndex, fretIndex)
      playNote(instrumentId, noteName, "8n")
    },
    [isReady, chordNotes, instrumentId, playNote],
  )

  const handleStrum = useCallback(
    async (direction: "down" | "up") => {
      if (!isReady || chordNotes.length === 0 || isStrumming) return

      await Tone.start()
      setIsStrumming(true)

      strumChord(instrumentId, chordNotes, direction)

      const totalDuration = chordNotes.length * 30 + 100
      setTimeout(() => setIsStrumming(false), totalDuration)
    },
    [isReady, chordNotes, isStrumming, strumChord, instrumentId],
  )

  const handleAddToLine = useCallback(() => {
    if (chordNotes.length === 0) return
    addChordToLine(chordNotes)
  }, [chordNotes, addChordToLine])

  const clearChord = useCallback(() => {
    setChordNotes([])
  }, [])

  const markers: Marker[] = chordNotes.map((note) => ({
    stringIndex: note.stringIndex,
    fretIndex: note.fret,
    type: "root",
    label: getNoteLabel(note.stringIndex, note.fret),
  }))

  return (
    <div className="flex flex-col gap-4">
      <Fretboard
        markers={markers}
        onFretClick={isReady ? handleFretClick : undefined}
        className={isReady ? "" : "opacity-50"}
      />

      <div className="flex items-center gap-2">
        <Button onClick={() => handleStrum("down")} disabled={!isReady || isStrumming}>
          Strum Down
        </Button>
        <Button onClick={() => handleStrum("up")} disabled={!isReady || isStrumming}>
          Strum Up
        </Button>
        <Button
          onClick={handleAddToLine}
          disabled={!isReady || chordNotes.length === 0 || isPlaying}
        >
          Add to Line
        </Button>
        <Button variant="outline" onClick={clearChord} disabled={chordNotes.length === 0}>
          Clear
        </Button>
        {!isReady && (
          <span className="text-muted-foreground text-sm">Select an instrument to edit</span>
        )}
      </div>
    </div>
  )
}
