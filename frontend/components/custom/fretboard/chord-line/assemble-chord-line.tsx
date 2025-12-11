import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import useFretboardContext, { FretPositions } from "../fretboard-context"
import {
  PlayIcon,
  PauseIcon,
  SquareIcon,
  XIcon,
  Trash2Icon,
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import * as Tone from "tone"
import { Input } from "@/components/ui/input"
import StrumPatternDialog, { StrumNote } from "./strum-pattern-dialog"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

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
    Infinity
  )
  const maxFret = positions.reduce(
    (max, fret) => (fret === -1 ? max : Math.max(max, fret)),
    -Infinity
  )

  const reversedPositions = [...positions].reverse()

  return (
    <div
      className={`relative group flex flex-col items-center p-2 rounded-lg border-2 transition-colors touch-none ${
        isActive
          ? "border-primary bg-primary/10"
          : "border-border bg-muted/50 hover:border-muted-foreground/50"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex gap-1">
        {reversedPositions.map((fret, index) => (
          <div
            key={`chordLine-${index}`}
            className="w-4.5 h-24 flex flex-col items-center relative"
          >
            <div
              className={`absolute h-24 left-1/2 -translate-x-1/2 bg-muted-foreground/30
                ${index === 1 || index === 0 ? "w-0.5" : "w-px"}
              `}
            />
            {fret === -1 ? (
              <span className="text-xs text-muted-foreground">x</span>
            ) : (
              <div
                className="w-4.5 h-4.5 rounded-full bg-primary flex items-center justify-center absolute"
                style={{
                  top: `calc(${
                    ((fret - minFret) / (maxFret - minFret)) * 81.25
                  }%)`,
                }}
              >
                <span className="text-xs font-mono text-primary-foreground leading-none text-center font-bold">
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isDragDisabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragDisabled ? "default" : "grab",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group"
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
      >
        <XIcon className="w-3 h-3" />
      </button>
      <MiniChordDisplay
        positions={positions}
        isActive={isActive}
        isDragging={isDragging}
      />
    </div>
  )
}

export default function AssembleChordLine() {
  const {
    chordLine,
    removeChordFromLine,
    reorderChordLine,
    clearChordLine,
    strumNotes,
  } = useFretboardContext()

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
    })
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

  const activeChord = activeId
    ? chordLine.find((item) => item.id === activeId)
    : null

  // Calculate how many strums per chord based on pattern or default
  const strumsPerChord =
    strumPattern.length > 0 ? strumPattern.length : DEFAULT_STRUMS_PER_CHORD

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
        for (
          let strumIdx = 0;
          strumIdx < DEFAULT_STRUMS_PER_CHORD;
          strumIdx++
        ) {
          const strumTime =
            chordStartTime + (strumIdx / DEFAULT_STRUMS_PER_CHORD) * barDuration
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-xl">Chord Line</h3>
        <div className="flex gap-2 items-center">
          <StrumPatternDialog
            setStrumPattern={setStrumPattern}
            strumPattern={strumPattern}
            bpm={bpm}
          />
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center flex-col">
            <Input
              type="number"
              value={bpm}
              min={30}
              max={240}
              step={1}
              onChange={(e) => setBpm(Math.round(Number(e.target.value)))}
              className="w-16 h-6 p-0 text-center text-base! font-mono rounded-b-none"
            />
            <div className="grid grid-cols-2 grid-rows-1 items-stretch justify-stretch">
              <button
                disabled={bpm >= 240}
                onClick={() => setBpm(Math.round((bpm + 5) / 5) * 5)}
                className="text-center leading-0 border-r-0 border border-t-0 h-4 w-8 rounded-bl-sm hover:bg-accent not-disabled:cursor-pointer"
              >
                +
              </button>
              <button
                disabled={bpm <= 30}
                onClick={() => setBpm(Math.round((bpm - 5) / 5) * 5)}
                className="text-center leading-0 border-l-0 border-t-0 border h-4 w-8 rounded-br-sm hover:bg-accent not-disabled:cursor-pointer"
              >
                -
              </button>
            </div>
          </div>
          <div className="h-6 w-px bg-border" />
          <Button
            variant="outline"
            size="icon"
            onClick={togglePlayback}
            disabled={chordLine.length === 0}
          >
            {isPlaying ? (
              <PauseIcon className="w-4 h-4" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={stopPlayback}
            disabled={!isPlaying && currentChordIndex === 0}
          >
            <SquareIcon className="w-4 h-4" />
          </Button>
          <div className="h-6 w-px bg-border" />
          <Button
            variant="outline"
            size="icon"
            onClick={clearChordLine}
            disabled={chordLine.length === 0}
          >
            <Trash2Icon className="w-4 h-4" />
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
                <div
                  key={item.id}
                  className="flex flex-col items-center gap-1"
                >
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
                          className={`w-2 h-2 rounded-full ${
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
