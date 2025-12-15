"use client"

import AssembleChordLine from "./chord-line/assemble-chord-line"
import FretboardCanvas from "./fretboard-canvas"
import FretboardChords from "./fretboard-chords"
import useFretboardContext from "./fretboard-context"
import FretControls from "./fretboard-controls"
import FretboardInstrument from "./fretboard-instrument"
import FretboardTuning from "./fretboard-tuning"

export default function FretboardMain() {
  const { fretPositions, setFretPositions, tuning, strumNotes, addChordToLine } =
    useFretboardContext()
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 pt-24">
      <FretboardCanvas
        fretPositions={fretPositions}
        setFretPositions={setFretPositions}
        tuning={tuning}
      />
      <FretControls
        fretPositions={fretPositions}
        setFretPositions={setFretPositions}
        strumNotes={strumNotes}
        addChordToLine={addChordToLine}
      />
      <div className="grid w-full grid-cols-3 gap-4">
        <FretboardChords />
        <FretboardTuning />
        <FretboardInstrument />
      </div>
      <AssembleChordLine />
    </div>
  )
}
