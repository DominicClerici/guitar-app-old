"use client"

import { Card } from "@/components/ui/card"
import FilterControls from "../fretboard/filter-controls"
import FretboardCanvas from "../fretboard/fretboard-canvas"
import FretControls from "../fretboard/fretboard-controls"
import { useTabEffectsContext } from "./context/tab-effects-context"
import TabEditorChords from "./controls/tab-editor-chords"
import TabEditorTuning from "./controls/tab-editor-tuning"
import ChordLineEditor from "./music-lines/chord-line-editor"
import { useTabContext } from "./tab-context-main"

export default function TabEditorMain() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-stretch gap-4 py-24">
      <TabEditorFretboard />
      {/* <TabEditorFilterControls /> */}
      <TabEditorChordAndMelodyControls />
      <div className="grid grid-cols-2 gap-4">
        <TabEditorChordsControls />
        <TabEditorTuningControls />
      </div>
      <TabEditorFilterControls />
    </div>
  )
}

function TabEditorChordAndMelodyControls() {
  return (
    <Card>
      <ChordLineEditor />
    </Card>
  )
}

function TabEditorChordsControls() {
  const { fretPositions, tuning } = useTabContext()
  return (
    <Card>
      <TabEditorChords fretPositions={fretPositions} tuning={tuning} />
    </Card>
  )
}

function TabEditorFilterControls() {
  const { effects, setEffects } = useTabEffectsContext()
  return (
    <Card>
      <FilterControls effects={effects} setEffects={setEffects} />
    </Card>
  )
}

function TabEditorTuningControls() {
  const { tuning, setTuning, instrument, changeInstrument } = useTabContext()
  return (
    <Card>
      <TabEditorTuning
        tuning={tuning}
        setTuning={setTuning}
        instrument={instrument}
        changeInstrument={changeInstrument}
      />
    </Card>
  )
}

function TabEditorFretboard() {
  const { fretPositions, setFretPositions, tuning, strumNotes, addChordToLine } = useTabContext()
  return (
    <>
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
    </>
  )
}
