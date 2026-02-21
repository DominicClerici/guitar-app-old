"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  ChevronDown,
  Clock,
  Dices,
  Eye,
  EyeOff,
  Hash,
  Infinity,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import NumberTicker from "../ui/number-ticker"
import ScaleShapeDisplay from "../ui/scale-shape-display"
import SlidingTab from "../ui/sliding-tab"
import TimePicker from "../ui/time-picker"

const MUSICAL_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const

// Semitones from C for each open string (low E → high E) and major scale degrees
const OPEN_STRING_SEMITONES = [4, 9, 2, 7, 11, 4]
const MAJOR_DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11]

// C major CAGED shapes — fret positions per string (low E → high E)
const CAGED_MAJOR_SHAPES = [
  {
    label: "C",
    data: [
      [0, 1, 3],
      [0, 2, 3],
      [0, 2, 3],
      [0, 2],
      [0, 1, 3],
      [0, 1, 3],
    ],
  },
  {
    label: "A",
    data: [
      [3, 5],
      [2, 3, 5],
      [2, 3, 5],
      [2, 4, 5],
      [3, 5],
      [3, 5],
    ],
  },
  {
    label: "G",
    data: [
      [5, 7, 8],
      [5, 7, 8],
      [5, 7],
      [4, 5, 7],
      [5, 6, 8],
      [5, 7, 8],
    ],
  },
  {
    label: "E",
    data: [
      [7, 8, 10],
      [7, 8, 10],
      [7, 9, 10],
      [7, 9],
      [8, 10],
      [7, 8, 10],
    ],
  },
  {
    label: "D",
    data: [
      [10, 12],
      [10, 12],
      [10, 12],
      [9, 10, 12],
      [10, 12, 13],
      [10, 12, 13],
    ],
  },
]

type SessionType = "infinite" | "timed" | "shapes"
type NoteVisibility = "all" | "roots" | "chordTones" | "hidden"

interface PracticeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle: string
  href: string
  gradient: string
  shapeCount?: number
  formulaType: "scale" | "arpeggio" | "caged"
  formulaId: string
  hideShapes?: boolean
}

export default function PracticeDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  href,
  gradient,
  shapeCount = 5,
  formulaType,
  formulaId,
  hideShapes = false,
}: PracticeDialogProps) {
  const router = useRouter()

  const [sessionType, setSessionType] = useState<SessionType>("infinite")
  const [duration, setDuration] = useState({ minutes: 5, seconds: 0 })
  const [targetShapes, setTargetShapes] = useState(10)
  const [isRandomKey, setIsRandomKey] = useState(true)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [noteVisibility, setNoteVisibility] = useState<NoteVisibility>("all")
  const [isRandomShapes, setIsRandomShapes] = useState(true)
  const [selectedShapes, setSelectedShapes] = useState<number[]>([])
  const [selectedDegrees, setSelectedDegrees] = useState<number[]>([1, 2, 3, 4, 5, 6, 7])
  const [multiShapeMode, setMultiShapeMode] = useState<"single" | "adjacent" | "full">("single")

  const toggleShape = useCallback((shape: number) => {
    setIsRandomShapes(false)
    setSelectedShapes((prev) => {
      if (prev.includes(shape)) {
        if (prev.length === 1) return prev
        return prev.filter((s) => s !== shape)
      }
      return [...prev, shape].sort((a, b) => a - b)
    })
  }, [])

  const selectAllShapes = useCallback(() => {
    setIsRandomShapes(true)
    setSelectedShapes([])
  }, [])

  const toggleKey = useCallback((key: string) => {
    setIsRandomKey(false)
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }, [])

  const toggleDegree = useCallback((degree: number) => {
    setSelectedDegrees((prev) => {
      if (prev.includes(degree)) {
        if (prev.length === 1) return prev
        return prev.filter((d) => d !== degree)
      }
      return [...prev, degree].sort((a, b) => a - b)
    })
  }, [])

  const shapeDotIsDimmed = useCallback(
    (stringIndex: number, fret: number) => {
      if (noteVisibility === "all" && selectedDegrees.length === 7) return false
      const semitones = (OPEN_STRING_SEMITONES[stringIndex] + fret) % 12
      const degree = MAJOR_DEGREE_SEMITONES.indexOf(semitones) + 1
      if (noteVisibility === "hidden") return true
      if (noteVisibility === "roots") return degree !== 1
      if (noteVisibility === "chordTones") return ![1, 3, 5].includes(degree)
      return !selectedDegrees.includes(degree)
    },
    [noteVisibility, selectedDegrees],
  )

  const isMajorScale = formulaId === "majorScale" || formulaId === "major"

  const noKeysSelected = !isRandomKey && selectedKeys.length === 0

  const handleStart = useCallback(() => {
    if (noKeysSelected) return

    const config = {
      mode: "practice",
      sessionType,
      duration: sessionType === "timed" ? duration : null,
      targetShapes: sessionType === "shapes" ? targetShapes : null,
      key: isRandomKey ? "random" : selectedKeys[0],
      keys: isRandomKey ? [] : selectedKeys,
      shapes: isRandomShapes ? Array.from({ length: shapeCount }, (_, i) => i + 1) : selectedShapes,
      startedAt: Date.now(),
      formulaType,
      formulaId,
      scaleName: title,
      gradient,
      ...(formulaType === "caged" && { noteVisibility }),
      ...(isMajorScale && selectedDegrees.length < 7 && { selectedDegrees }),
      ...(isMajorScale && multiShapeMode !== "single" && { multiShapeMode }),
    }

    sessionStorage.setItem("practiceConfig", JSON.stringify(config))
    router.push(href)
  }, [
    sessionType,
    duration,
    targetShapes,
    isRandomKey,
    selectedKeys,
    isRandomShapes,
    selectedShapes,
    shapeCount,
    href,
    router,
    formulaType,
    formulaId,
    title,
    gradient,
    noteVisibility,
    isMajorScale,
    selectedDegrees,
    multiShapeMode,
    noKeysSelected,
  ])

  const formatDuration = () => {
    const m = String(duration.minutes).padStart(2, "0")
    const s = String(duration.seconds).padStart(2, "0")
    return `${m}:${s}`
  }

  const shapesLabel = isRandomShapes
    ? "Random"
    : selectedShapes.length <= 3
      ? CAGED_MAJOR_SHAPES.filter((_, i) => selectedShapes.includes(i + 1))
          .map(({ label }) => label)
          .join(", ")
      : `${selectedShapes.length} shapes`

  const keyLabel = isRandomKey
    ? "Random"
    : selectedKeys.length === 0
      ? "Select keys"
      : selectedKeys.length <= 3
        ? selectedKeys.join(", ")
        : `${selectedKeys.length} keys`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <div className={`relative bg-gradient-to-br ${gradient} px-6 py-5`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <DialogHeader className="relative z-10">
            <DialogDescription className="text-xs font-medium tracking-widest text-white/70 uppercase">
              {subtitle}
            </DialogDescription>
            <DialogTitle className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {title}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 pt-4 pb-2">
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Session
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSessionType("infinite")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                  sessionType === "infinite"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50 hover:bg-accent",
                )}
              >
                <Infinity className="size-3.5" />
                Infinite
              </button>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setSessionType("timed")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                      sessionType === "timed"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent",
                    )}
                  >
                    <Clock className="size-3.5" />
                    {formatDuration()}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-fit p-3" align="start">
                  <TimePicker value={duration} onChange={setDuration} />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setSessionType("shapes")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                      sessionType === "shapes"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent",
                    )}
                  >
                    <Hash className="size-3.5" />
                    {targetShapes}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-fit p-3" align="start">
                  <div className="space-y-3">
                    <p className="text-muted-foreground text-xs font-medium">Shape count</p>
                    <NumberTicker
                      value={targetShapes}
                      onChange={setTargetShapes}
                      min={1}
                      max={100}
                      step={1}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Key
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                    noKeysSelected
                      ? "border-destructive/50 text-destructive"
                      : "border-border hover:border-primary/50 hover:bg-accent",
                  )}
                >
                  {isRandomKey && <Dices className="text-primary size-3.5" />}
                  <span className={cn(isRandomKey && "text-primary")}>{keyLabel}</span>
                  <ChevronDown className="text-muted-foreground size-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRandomKey(true)
                      setSelectedKeys([])
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-all",
                      isRandomKey
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent",
                    )}
                  >
                    <Dices className="size-3.5" />
                    Random
                  </button>
                  <div className="grid grid-cols-6 gap-1.5">
                    {MUSICAL_KEYS.map((key) => {
                      const isSelected = selectedKeys.includes(key)
                      return (
                        <button
                          key={`key-${key}`}
                          type="button"
                          onClick={() => toggleKey(key)}
                          className={cn(
                            "rounded-md border px-2 py-1.5 text-center text-sm font-medium transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50 hover:bg-accent",
                          )}
                        >
                          {key}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Note Visibility + Scale Degrees — merged section */}
          {formulaType === "caged" && (
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Notes
              </label>
              <SlidingTab
                value={noteVisibility}
                onChange={(value) => setNoteVisibility(value as NoteVisibility)}
                options={[
                  { label: "All", value: "all", icon: Eye },
                  { label: "Chord Tones", value: "chordTones", icon: Eye },
                  { label: "Roots", value: "roots", icon: Eye },
                  { label: "Hidden", value: "hidden", icon: EyeOff },
                ]}
              />
              <div className="flex flex-wrap items-center gap-2">
                {/* Scale degrees inline, only when "all" visibility and major scale */}

                <div
                  className={`flex items-center gap-1 ${noteVisibility !== "all" && "pointer-events-none opacity-50"}`}
                >
                  <span className="text-muted-foreground mr-1 text-xs">Degrees:</span>
                  {[1, 2, 3, 4, 5, 6, 7].map((degree) => {
                    let isSelected = false
                    if (noteVisibility === "all") {
                      isSelected = selectedDegrees.includes(degree)
                    } else if (noteVisibility === "roots") {
                      isSelected = degree === 1
                    } else if (noteVisibility === "chordTones") {
                      isSelected = [1, 3, 5].includes(degree)
                    }
                    return (
                      <button
                        key={`degree-${degree}`}
                        type="button"
                        onClick={() => toggleDegree(degree)}
                        className={cn(
                          "flex size-7 cursor-pointer items-center justify-center rounded-md text-xs font-bold transition-all",
                          isSelected
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        {degree}
                      </button>
                    )
                  })}
                  {selectedDegrees.length < 7 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDegrees([1, 2, 3, 4, 5, 6, 7])}
                      className="text-muted-foreground hover:text-foreground ml-1 cursor-pointer text-sm transition-colors"
                    >
                      All
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Display Mode — compact segmented control */}
          {isMajorScale && formulaType === "caged" && (
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Display
              </label>
              <SlidingTab
                value={multiShapeMode}
                onChange={(value) => {
                  const v = value as "single" | "adjacent" | "full"
                  setMultiShapeMode(v)
                  if (v !== "single") {
                    setIsRandomShapes(true)
                    setSelectedShapes([])
                  }
                }}
                options={[
                  {
                    label: "Single",
                    value: "single",
                    icon: Eye,
                    tooltip: "Show one shape at a time",
                  },
                  {
                    label: "Adjacent",
                    value: "adjacent",
                    icon: Eye,
                    tooltip: "Show two adjacent shapes at a time",
                  },
                  { label: "Full", value: "full", icon: Eye, tooltip: "Show all shapes at once" },
                ]}
              />
            </div>
          )}

          {/* Shapes — popover selector */}
          {!hideShapes && (
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Shapes
              </label>
              {multiShapeMode !== "single" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled
                      className="border-border flex w-fit cursor-not-allowed items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium opacity-50"
                    >
                      <Dices className="text-primary size-3.5" />
                      <span className="text-primary">Random</span>
                      <ChevronDown className="text-muted-foreground size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Set display to Single to choose specific shapes</TooltipContent>
                </Tooltip>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                        "border-border hover:border-primary/50 hover:bg-accent",
                      )}
                    >
                      {isRandomShapes && <Dices className="text-primary size-3.5" />}
                      <span className={cn(isRandomShapes && "text-primary")}>{shapesLabel}</span>
                      <ChevronDown className="text-muted-foreground size-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-fit p-3" align="start">
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => selectAllShapes()}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-all",
                          isRandomShapes
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50 hover:bg-accent",
                        )}
                      >
                        <Dices className="size-3.5" />
                        Random
                      </button>
                      {formulaType === "caged" ? (
                        <div className="grid grid-cols-5 gap-1.5">
                          {CAGED_MAJOR_SHAPES.map((shape, i) => (
                            <ScaleShapeDisplay
                              key={shape.label}
                              label={shape.label}
                              data={shape.data}
                              selected={selectedShapes.includes(i + 1)}
                              onClick={() => toggleShape(i + 1)}
                              isDimmed={shapeDotIsDimmed}
                              className="h-24 w-24"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {Array.from({ length: shapeCount }, (_, i) => i + 1).map((shape) => {
                            const isSelected = selectedShapes.includes(shape)
                            return (
                              <button
                                key={`shape-${shape}`}
                                type="button"
                                onClick={() => toggleShape(shape)}
                                className={cn(
                                  "rounded-md border px-2 py-1.5 text-center text-sm font-medium transition-all",
                                  isSelected
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border hover:border-primary/50 hover:bg-accent",
                                )}
                              >
                                {shape}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-border border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {noKeysSelected ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button disabled>
                    Start Practice
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>At least 1 key must be selected</TooltipContent>
            </Tooltip>
          ) : (
            <Button onClick={handleStart}>
              Start Practice
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
