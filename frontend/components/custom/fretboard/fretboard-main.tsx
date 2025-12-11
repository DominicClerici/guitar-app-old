"use client"

import FretboardChords from "./fretboard-chords"
import FretboardTuning from "./fretboard-tuning"
import FretboardCanvas from "./fretboard-canvas"
import FretboardInstrument from "./fretboard-instrument"
import AssembleChordLine from "./chord-line/assemble-chord-line"
import FretControls from "./fretboard-controls"

export default function FretboardMain() {
  return (
    <div className="flex flex-col items-center gap-4 pt-24 max-w-7xl mx-auto w-full">
      <FretboardCanvas />
      <FretControls />
      <div className="grid grid-cols-3 gap-4 w-full">
        <FretboardChords />
        <FretboardTuning />
        <FretboardInstrument />
      </div>
      <AssembleChordLine />
    </div>
  )
}
