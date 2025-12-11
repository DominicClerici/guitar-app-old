import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { useEffect, useRef, useState } from "react"
import * as Tone from "tone"
import useFretboardContext, { FretPositions } from "../fretboard-context"
import StrumPatternDialog, { StrumNote } from "./strum-pattern-dialog"

const DEFAULT_STRUMS_PER_CHORD = 4

function MiniChordDisplay({
  positions,
  isActive,
  isDragging,
}: {
  positions: FretPositions
  isActive: boolean
  isDragging?: boolean
}) {
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
      className={`group relative flex touch-none flex-col items-center rounded-lg border-2 p-2 transition-colors ${
        isActive
          ? "border-primary bg-primary/10"
          : "border-border bg-muted/50 hover:border-muted-foreground/50"
      } ${isDragging ? "opacity-50" : ""}`}
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
  isActive,
  onRemove,
  isDragDisabled,
}: {
  id: string
  positions: FretPositions
  isActive: boolean
  onRemove: () => void
  isDragDisabled: boolean
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="group relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="bg-destructive text-destructive-foreground absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
      >
        <XIcon className="h-3 w-3" />
      </button>
      <MiniChordDisplay positions={positions} isActive={isActive} isDragging={isDragging} />
    </div>
  )
}

export default function AssembleChordLine() {
  const { chordLine, removeChordFromLine, reorderChordLine, clearChordLine, strumNotes } =
    useFretboardContext()

  const [bpm, setBpm] = useState(60)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentChordIndex, setCurrentChordIndex] = useState(0)
  const [currentStrumCount, setCurrentStrumCount] = useState(0)
  const [strumPattern, setStrumPattern] = useState<StrumNote[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const partRef = useRef<Tone.Part | null>(null)

  // dnd-kit sensors for drag and drop
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

  // Calculate how many strums per chord based on pattern or default
  const strumsPerChord = strumPattern.length > 0 ? strumPattern.length : DEFAULT_STRUMS_PER_CHORD

  const stopPlayback = () => {
    if (partRef.current) {
      partRef.current.stop()
      partRef.current.dispose()
      partRef.current = null
    }
    Tone.getTransport().stop()
    Tone.getTransport().position = 0
    setIsPlaying(false)
    setCurrentChordIndex(0)
    setCurrentStrumCount(0)
  }

  const startPlayback = async () => {
    if (chordLine.length === 0) return

    await Tone.start()
    Tone.getTransport().bpm.value = bpm

    // Duration of one bar in Tone.js notation (4 quarter notes = 1 bar)
    const barDuration = Tone.Time("1m").toSeconds()

    // Total duration for all chords (each chord gets one bar)
    const totalDuration = barDuration * chordLine.length

    // Build part events with absolute times
    const events: Array<{
      time: number
      chordIndex: number
      strumIndex: number
      direction: "up" | "down"
    }> = []

    for (let chordIdx = 0; chordIdx < chordLine.length; chordIdx++) {
      const chordStartTime = chordIdx * barDuration

      if (strumPattern.length > 0) {
        // Use the custom strum pattern
        strumPattern.forEach((note, strumIdx) => {
          // note.position is 0-1 normalized within the bar
          const strumTime = chordStartTime + note.position * barDuration
          events.push({
            time: strumTime,
            chordIndex: chordIdx,
            strumIndex: strumIdx,
            direction: note.direction,
          })
        })
      } else {
        // Use default even strums (4 quarter notes)
        for (let strumIdx = 0; strumIdx < DEFAULT_STRUMS_PER_CHORD; strumIdx++) {
          const strumTime = chordStartTime + (strumIdx / DEFAULT_STRUMS_PER_CHORD) * barDuration
          events.push({
            time: strumTime,
            chordIndex: chordIdx,
            strumIndex: strumIdx,
            direction: "down",
          })
        }
      }
    }

    type StrumEvent = {
      time: number
      chordIndex: number
      strumIndex: number
      direction: "up" | "down"
    }

    partRef.current = new Tone.Part<StrumEvent>((time, event) => {
      strumNotes(event.direction, chordLine[event.chordIndex].positions)
      // Schedule state updates slightly after audio to avoid race conditions
      Tone.getDraw().schedule(() => {
        setCurrentChordIndex(event.chordIndex)
        setCurrentStrumCount(event.strumIndex)
      }, time)
    }, events)

    partRef.current.loop = true
    partRef.current.loopEnd = totalDuration
    partRef.current.start(0)
    Tone.getTransport().start()
    setIsPlaying(true)
  }

  const togglePlayback = async () => {
    if (isPlaying) {
      if (partRef.current) {
        partRef.current.stop()
        partRef.current.dispose()
        partRef.current = null
      }
      Tone.getTransport().pause()
      setIsPlaying(false)
    } else {
      await startPlayback()
    }
  }

  useEffect(() => {
    if (isPlaying && chordLine.length === 0) {
      stopPlayback()
    }
  }, [chordLine.length, isPlaying])

  useEffect(() => {
    return () => {
      if (partRef.current) {
        partRef.current.dispose()
      }
      Tone.getTransport().stop()
    }
  }, [])

  return (
    <Card className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Chord Line</h3>
        <div className="flex items-center gap-2">
          <StrumPatternDialog
            setStrumPattern={setStrumPattern}
            strumPattern={strumPattern}
            bpm={bpm}
          />
          <div className="bg-border h-6 w-px" />
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
            onClick={togglePlayback}
            disabled={chordLine.length === 0}
          >
            {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={stopPlayback}
            disabled={!isPlaying && currentChordIndex === 0}
          >
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
            <div className="flex flex-wrap gap-3">
              {chordLine.map((item, index) => (
                <div key={item.id} className="flex flex-col items-center gap-1">
                  <SortableMiniChord
                    id={item.id}
                    positions={item.positions}
                    isActive={isPlaying && index === currentChordIndex}
                    onRemove={() => removeChordFromLine(item.id)}
                    isDragDisabled={isPlaying}
                  />
                  {isPlaying && index === currentChordIndex && (
                    <div className="flex gap-1">
                      {Array.from({ length: strumsPerChord }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 w-2 rounded-full ${
                            i <= currentStrumCount ? "bg-primary" : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeChord ? (
              <MiniChordDisplay positions={activeChord.positions} isActive={false} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </Card>
  )
}
