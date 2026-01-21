"use client"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import useTabs, { type GuitarInstrumentId, type LineChord } from "@/context/tabs-provider"
import { getNoteLabel } from "@/lib/audio/guitar-notes"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import * as Tone from "tone"

type MusicLineEditorProps = {
  instrumentId: GuitarInstrumentId
}

type SortableChordItemProps = {
  chord: LineChord
  index: number
  onRemove: (id: string) => void
  disabled: boolean
}

function SortableChordItem({ chord, index, onRemove, disabled }: SortableChordItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chord.id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const noteLabels = chord.notes
    .sort((a, b) => a.stringIndex - b.stringIndex)
    .map((n) => getNoteLabel(n.stringIndex, n.fret))
    .join(" ")

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-secondary flex items-center gap-2 rounded-md px-3 py-2"
      {...attributes}
      {...listeners}
    >
      <span className="text-muted-foreground text-xs">{index + 1}.</span>
      <span className="font-mono text-sm">{noteLabels}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(chord.id)
        }}
        disabled={disabled}
      >
        ×
      </Button>
    </div>
  )
}

export function MusicLineEditor({ instrumentId }: MusicLineEditorProps) {
  const {
    lineChords,
    removeChordFromLine,
    reorderLineChords,
    clearLine,
    bpm,
    setBpm,
    isPlaying,
    startPlayback,
    stopPlayback,
    getLoadingState,
  } = useTabs()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = lineChords.findIndex((c) => c.id === active.id)
    const newIndex = lineChords.findIndex((c) => c.id === over.id)
    reorderLineChords(oldIndex, newIndex)
  }

  const loadingState = getLoadingState(instrumentId)
  const isReady = loadingState === "loaded"

  const handlePlay = async () => {
    await Tone.start()
    startPlayback(instrumentId)
  }

  const handleStop = () => {
    stopPlayback(instrumentId)
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Music Line</h3>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">BPM: {bpm}</span>
          <Slider
            value={[bpm]}
            onValueChange={([value]) => setBpm(value)}
            min={40}
            max={200}
            step={1}
            className="w-32"
            disabled={isPlaying}
          />
        </div>
      </div>

      {lineChords.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No chords added yet. Use &quot;Add to Line&quot; in the chord editor to add chords.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={lineChords.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex flex-wrap gap-2">
              {lineChords.map((chord, index) => (
                <SortableChordItem
                  key={chord.id}
                  chord={chord}
                  index={index}
                  onRemove={removeChordFromLine}
                  disabled={isPlaying}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-2">
        {isPlaying ? (
          <Button onClick={handleStop} variant="destructive">
            Stop
          </Button>
        ) : (
          <Button onClick={handlePlay} disabled={!isReady || lineChords.length === 0}>
            Play
          </Button>
        )}
        <Button
          variant="outline"
          onClick={clearLine}
          disabled={lineChords.length === 0 || isPlaying}
        >
          Clear All
        </Button>
        {!isReady && (
          <span className="text-muted-foreground text-sm">Select an instrument first</span>
        )}
      </div>
    </div>
  )
}
