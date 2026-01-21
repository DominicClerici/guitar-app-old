"use client"

import { useState } from "react"
import useTabs, { type GuitarInstrumentId } from "@/context/tabs-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AudioEffectsControls } from "./audio-effects-controls"
import { ChordEditor } from "./chord-editor"
import { MusicLineEditor } from "./music-line-editor"

export default function TabEditor() {
  const { loadInstrument, getLoadingState, instruments } = useTabs()
  const [selectedInstrument, setSelectedInstrument] = useState<GuitarInstrumentId | "">("")

  const handleInstrumentChange = async (value: string) => {
    const instrumentId = value as GuitarInstrumentId
    setSelectedInstrument(instrumentId)
    await loadInstrument(instrumentId)
  }

  const loadingState = selectedInstrument ? getLoadingState(selectedInstrument) : "idle"

  return (
    <div className="flex flex-col gap-4">
      <h2>Tab Editor</h2>

      <div className="flex items-center gap-2">
        <Select value={selectedInstrument} onValueChange={handleInstrumentChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select guitar" />
          </SelectTrigger>
          <SelectContent>
            {instruments.map((instrument) => (
              <SelectItem key={instrument.id} value={instrument.id}>
                {instrument.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {loadingState === "loading" && (
          <span className="text-muted-foreground text-sm">Loading samples...</span>
        )}
        {loadingState === "loaded" && (
          <span className="text-green-600 text-sm">Ready</span>
        )}
        {loadingState === "error" && (
          <span className="text-destructive text-sm">Error loading samples</span>
        )}
      </div>

      {selectedInstrument && <ChordEditor instrumentId={selectedInstrument} />}

      {selectedInstrument && <MusicLineEditor instrumentId={selectedInstrument} />}

      <AudioEffectsControls />
    </div>
  )
}
