"use client"

import { useState } from "react"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ALL_KEYS, getMajorScale, getNoteName } from "@/lib/scales/major-scale"

export default function ScalesPracticeClient() {
  const [selectedKeyIndex, setSelectedKeyIndex] = useState(0) // C major by default
  const [showDegrees, setShowDegrees] = useState(false)

  const scaleNotes = getMajorScale(selectedKeyIndex)

  const markers: Marker[] = scaleNotes.map((note) => ({
    stringIndex: note.stringIndex,
    fretIndex: note.fretIndex,
    type: note.degree === 1 ? "root" : "note",
    label: getNoteName(note.noteIndex),
    degree: note.degree,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Key:</span>
          <Select
            value={String(selectedKeyIndex)}
            onValueChange={(value) => setSelectedKeyIndex(Number(value))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_KEYS.map((key) => (
                <SelectItem key={key.noteIndex} value={String(key.noteIndex)}>
                  {key.name} Major
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Show degrees:</span>
          <Switch checked={showDegrees} onCheckedChange={setShowDegrees} />
        </div>
      </div>

      <Fretboard markers={markers} showDegree={showDegrees} className="w-full" />
    </div>
  )
}
