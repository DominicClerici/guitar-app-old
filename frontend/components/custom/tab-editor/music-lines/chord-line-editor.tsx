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
import { FretPositions } from "../context/tab-fret-context"
import { PlayerCallbacks } from "../context/tab-player-context"
import useTabContext from "../tab-context-main"

const CHORD_LINE_PLAYER_ID = "chord-line-editor"

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
      className={`group relative flex touch-none flex-col items-center rounded-lg border-2 p-2 transition-colors ${
        isActive
          ? "border-primary bg-primary/10"
          : "border-border bg-muted/50 hover:border-muted-foreground/50"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex gap-1">
        {reversedPositions.map((fret, index) => (
          <div key={`chordLine-${index}`} className="relative flex h-24 w-4.5 flex-col items-center">
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
        className="bg-destructive text-destructive-foreground absolute -top-2 -right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
      >
        <XIcon className="h-3 w-3" />
      </button>
      <MiniChordDisplay positions={positions} isActive={isActive} isDragging={isDragging} />
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
    startPlayback,
    stopPlayback,
    registerPlayer,
    unregisterPlayer,
  } = useTabContext()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [currentChordIndex, setCurrentChordIndex] = useState(0)
  const [currentBeat, setCurrentBeat] = useState(0)

  // Ref to track position updates from transport
  const positionUpdateRef = useRef<number | null>(null)

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

  const activeChord = activeId ? chordLine.find((item) => item.id === activeId) : null

  // Register as a player to receive playback callbacks
  useEffect(() => {
    const callbacks: PlayerCallbacks = {
      onPlay: () => {
        setCurrentChordIndex(0)
        setCurrentBeat(0)
        // Start position tracking
        const updatePosition = () => {
          const position = Tone.getTransport().position as string
          const [bars, beats] = position.split(":").map(Number)
          // Each chord occupies 1 full bar, so chordIndex = bar number (mod total chords)
          const chordIndex = bars % chordLine.length
          setCurrentChordIndex(chordIndex)
          setCurrentBeat(beats)
          positionUpdateRef.current = requestAnimationFrame(updatePosition)
        }
        positionUpdateRef.current = requestAnimationFrame(updatePosition)
      },
      onStop: () => {
        if (positionUpdateRef.current) {
          cancelAnimationFrame(positionUpdateRef.current)
          positionUpdateRef.current = null
        }
        setCurrentChordIndex(0)
        setCurrentBeat(0)
      },
      onPause: () => {
        if (positionUpdateRef.current) {
          cancelAnimationFrame(positionUpdateRef.current)
          positionUpdateRef.current = null
        }
      },
      onResume: () => {
        const updatePosition = () => {
          const position = Tone.getTransport().position as string
          const [bars, beats] = position.split(":").map(Number)
          // Each chord occupies 1 full bar, so chordIndex = bar number (mod total chords)
          const chordIndex = bars % chordLine.length
          setCurrentChordIndex(chordIndex)
          setCurrentBeat(beats)
          positionUpdateRef.current = requestAnimationFrame(updatePosition)
        }
        positionUpdateRef.current = requestAnimationFrame(updatePosition)
      },
      onBpmChange: () => {
        // BPM is handled by transport automatically
      },
    }

    registerPlayer(CHORD_LINE_PLAYER_ID, callbacks)

    return () => {
      unregisterPlayer(CHORD_LINE_PLAYER_ID)
      if (positionUpdateRef.current) {
        cancelAnimationFrame(positionUpdateRef.current)
      }
    }
  }, [registerPlayer, unregisterPlayer, chordLine.length])

  // Stop playback if chord line becomes empty
  useEffect(() => {
    if (isPlaying && chordLine.length === 0) {
      stopPlayback()
    }
  }, [chordLine.length, isPlaying, stopPlayback])

  const handleTogglePlayback = async () => {
    if (isPlaying) {
      stopPlayback()
    } else {
      if (chordLine.length > 0) {
        await startPlayback()
      }
    }
  }

  const handleStop = () => {
    stopPlayback()
  }

  return (
    <Card className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold">Chord Line</h3>
        <div className="flex items-center gap-2">
          {/* BPM Control */}
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

          {/* Playback Controls */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleTogglePlayback}
            disabled={chordLine.length === 0}
          >
            {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleStop}
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
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 w-2 rounded-full ${
                            i <= currentBeat % 4 ? "bg-primary" : "bg-muted"
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
