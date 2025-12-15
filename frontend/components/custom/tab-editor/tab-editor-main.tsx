"use client"

import { Card } from "@/components/ui/card"
import FilterControls from "../fretboard/filter-controls"
import FretboardCanvas from "../fretboard/fretboard-canvas"
import FretControls from "../fretboard/fretboard-controls"
import { useTabEffectsContext } from "./context/tab-effects-context"
import TabEditorTuning from "./controls/tab-editor-tuning"
import { useTabContext } from "./tab-context-main"

export default function TabEditorMain() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-stretch gap-4 py-24">
      <TabEditorFretboard />
      <div className="grid grid-cols-2 gap-4">
        <TabEditorFilterControls />
        <TabEditorTuningControls />
      </div>
    </div>
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
  const { tuning, setTuning } = useTabContext()
  return (
    <Card>
      <TabEditorTuning tuning={tuning} setTuning={setTuning} />
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
