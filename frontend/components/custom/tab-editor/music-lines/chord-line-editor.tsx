import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { PauseIcon, PlayIcon, SquareIcon, Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import { FretPositions } from "../context/tab-fret-context"
import useTabContext from "../tab-context-main"

function MiniChordDisplay({ positions }: { positions: FretPositions }) {
  const minFret = positions.reduce(
    (min, fret) => (fret === -1 ? min : Math.min(min, fret)),
    Infinity,
  )
  const maxFret = positions.reduce(
    (max, fret) => (fret === -1 ? max : Math.max(max, fret)),
    -Infinity,
  )

  const reversedPositions = [...positions].reverse()

  return (
    <div
      className={`bg-background relative flex touch-none flex-col items-center rounded-md border p-2`}
    >
      <div className="flex gap-1">
        {reversedPositions.map((fret, index) => (
          <div
            key={`chordLine-${index}`}
            className="relative flex h-24 w-4.5 flex-col items-center"
          >
            <div
              className={`bg-muted-foreground/30 absolute left-1/2 h-24 -translate-x-1/2 ${index === 1 || index === 0 ? "w-0.5" : "w-px"} `}
            />
            {fret === -1 ? (
              <span className="text-muted-foreground text-xs">x</span>
            ) : (
              <div
                className="bg-primary absolute flex h-4.5 w-4.5 items-center justify-center rounded-full"
                style={{
                  top: `calc(${((fret - minFret) / (maxFret - minFret)) * 81.25}%)`,
                }}
              >
                <span className="text-primary-foreground text-center font-mono text-xs leading-none font-bold">
                  {fret}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SortableMiniChord({
  id,
  positions,
  onRemove,
  isDragDisabled,
  isOverlay = false,
}: {
  id: string
  positions: FretPositions
  onRemove: () => void
  isDragDisabled: boolean
  isOverlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isDragDisabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragDisabled ? "default" : "grab",
  }
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      style={style}
      data-dragging={isDragging}
      className={`group relative ${isDragging ? "opacity-50" : ""} cursor-default! px-2 py-1`}
    >
      <div
        {...listeners}
        className={`relative z-10 ${isOverlay ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <MiniChordDisplay positions={positions} />
      </div>
      <div
        className={` ${isOverlay ? "" : "-translate-y-2 opacity-0 transition-all duration-125 group-hover:translate-y-0 group-hover:opacity-100"} bg-background z-0 -mt-1.5 flex cursor-default items-center gap-1 rounded-b-lg border border-t-0 p-0.5 pt-2`}
      >
        <Button
          variant="outline"
          className={"hover:bg-destructive/5 hover:border-destructive/75 hover:text-destructive"}
          size="iconXs"
          onClick={onRemove}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  )
}

export default function ChordLineEditor() {
  const {
    chordLine,
    removeChordFromLine,
    reorderChordLine,
    clearChordLine,
    bpm,
    setBpm,
    isPlaying,
  } = useTabContext()

  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const chordIds = chordLine.map((item) => item.id)

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (over && active.id !== over.id) {
      const oldIndex = chordLine.findIndex((item) => item.id === active.id)
      const newIndex = chordLine.findIndex((item) => item.id === over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderChordLine(oldIndex, newIndex)
      }
    }
  }

  const activeChord = activeId ? chordLine.find((item) => item.id === activeId) : null

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Chord Line</h3>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <Input
              type="number"
              value={bpm}
              min={30}
              max={240}
              step={1}
              onChange={(e) => setBpm(Math.round(Number(e.target.value)))}
              className="h-6 w-16 rounded-b-none p-0 text-center font-mono text-base!"
            />
            <div className="grid grid-cols-2 grid-rows-1 items-stretch justify-stretch">
              <button
                disabled={bpm >= 240}
                onClick={() => setBpm(Math.round((bpm + 5) / 5) * 5)}
                className="hover:bg-accent h-4 w-8 rounded-bl-sm border border-t-0 border-r-0 text-center leading-0 not-disabled:cursor-pointer"
              >
                +
              </button>
              <button
                disabled={bpm <= 30}
                onClick={() => setBpm(Math.round((bpm - 5) / 5) * 5)}
                className="hover:bg-accent h-4 w-8 rounded-br-sm border border-t-0 border-l-0 text-center leading-0 not-disabled:cursor-pointer"
              >
                -
              </button>
            </div>
          </div>

          <div className="bg-border h-6 w-px" />

          <Button
            variant="outline"
            size="icon"
            onClick={() => {}}
            disabled={chordLine.length === 0}
          >
            {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={() => {}}>
            <SquareIcon className="h-4 w-4" />
          </Button>

          <div className="bg-border h-6 w-px" />

          <Button
            variant="outline"
            size="icon"
            onClick={clearChordLine}
            disabled={chordLine.length === 0}
          >
            <Trash2Icon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {chordLine.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No chords added yet. Use &quot;Add to Chord Line&quot; to add chords.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={chordIds} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap">
              {chordLine.map((item) => (
                <SortableMiniChord
                  id={item.id}
                  key={item.id}
                  positions={item.positions}
                  onRemove={() => removeChordFromLine(item.id)}
                  isDragDisabled={isPlaying}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeChord ? (
              <SortableMiniChord
                id={activeChord.id}
                positions={activeChord.positions}
                onRemove={() => {}}
                isDragDisabled={isPlaying}
                isOverlay={true}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </>
  )
}
