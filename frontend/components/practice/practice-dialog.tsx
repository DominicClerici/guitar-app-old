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
import NumberTicker from "@/components/ui/number-ticker"
import SlidingToggle from "@/components/ui/sliding-toggle"
import { cn } from "@/lib/utils"
import { BookOpen, Clock, Dices, Dumbbell, Eye, EyeOff, Hash, Infinity, Music } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import TimePicker from "../ui/time-picker"

const MUSICAL_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const

const SESSION_TYPES = [
  {
    id: "infinite",
    label: "Infinite",
    description: "Practice until you decide to stop",
    icon: Infinity,
  },
  {
    id: "timed",
    label: "Timed",
    description: "Practice for a set duration",
    icon: Clock,
  },
  {
    id: "shapes",
    label: "Shape Count",
    description: "Practice a specific number of shapes",
    icon: Hash,
  },
] as const

const NOTE_VISIBILITY_OPTIONS = [
  {
    id: "all" as const,
    label: "All Notes",
    icon: Eye,
  },
  {
    id: "roots" as const,
    label: "Roots Only",
    icon: Eye,
  },
  {
    id: "hidden" as const,
    label: "Hidden",
    icon: EyeOff,
  },
]

type SessionType = (typeof SESSION_TYPES)[number]["id"]
type NoteVisibility = (typeof NOTE_VISIBILITY_OPTIONS)[number]["id"]
type DialogMode = "learn" | "practice"

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
  supportLearnMode?: boolean
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
  supportLearnMode = false,
}: PracticeDialogProps) {
  const router = useRouter()

  const [mode, setMode] = useState<DialogMode>("learn")
  const [sessionType, setSessionType] = useState<SessionType>("infinite")
  const [duration, setDuration] = useState({ minutes: 5, seconds: 0 })
  const [targetShapes, setTargetShapes] = useState(10)
  const [selectedKey, setSelectedKey] = useState<string | "random">("random")
  const [noteVisibility, setNoteVisibility] = useState<NoteVisibility>("all")
  const [selectedShapes, setSelectedShapes] = useState<number[]>(
    Array.from({ length: shapeCount }, (_, i) => i + 1),
  )

  const toggleShape = useCallback((shape: number) => {
    setSelectedShapes((prev) => {
      if (prev.includes(shape)) {
        if (prev.length === 1) return prev
        return prev.filter((s) => s !== shape)
      }
      return [...prev, shape].sort((a, b) => a - b)
    })
  }, [])

  const selectAllShapes = useCallback(() => {
    setSelectedShapes(Array.from({ length: shapeCount }, (_, i) => i + 1))
  }, [shapeCount])

  const handleStart = useCallback(() => {
    const config = {
      mode,
      sessionType,
      duration: sessionType === "timed" ? duration : null,
      targetShapes: sessionType === "shapes" ? targetShapes : null,
      key: selectedKey,
      shapes: selectedShapes,
      startedAt: Date.now(),
      formulaType,
      formulaId,
      scaleName: title,
      gradient,
      ...(formulaType === "caged" && { noteVisibility }),
    }

    sessionStorage.setItem("practiceConfig", JSON.stringify(config))

    if (supportLearnMode && mode === "learn") {
      router.push(`/dashboard/learn/${formulaId}`)
    } else {
      router.push(href)
    }
  }, [
    mode,
    sessionType,
    duration,
    targetShapes,
    selectedKey,
    selectedShapes,
    href,
    router,
    formulaType,
    formulaId,
    title,
    gradient,
    supportLearnMode,
    noteVisibility,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0 sm:max-w-xl">
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

        <div className="space-y-6 px-6 py-5">
          {supportLearnMode && (
            <div className="flex justify-center">
              <SlidingToggle
                options={[
                  { label: "Learn", value: "learn", icon: <BookOpen /> },
                  { label: "Practice", value: "practice", icon: <Dumbbell /> },
                ]}
                value={mode}
                onChange={(value) => setMode(value as DialogMode)}
                className="h-12"
              />
            </div>
          )}

          {(!supportLearnMode || mode === "practice") && (
            <>
              <div className="space-y-3">
                <label className="text-sm font-medium">Session Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {SESSION_TYPES.map((type) => {
                    const Icon = type.icon
                    const isSelected = sessionType === type.id
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setSessionType(type.id)}
                        className={cn(
                          "group relative flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-all",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50 hover:bg-accent",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-5 transition-transform group-hover:scale-110",
                            isSelected && "text-primary",
                          )}
                        />
                        <span className="text-sm font-medium">{type.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 items-center justify-items-center gap-4">
                <div
                  className={cn(
                    "transition-opacity",
                    sessionType !== "timed" && "pointer-events-none opacity-25",
                  )}
                >
                  <TimePicker
                    value={{ minutes: duration.minutes, seconds: duration.seconds }}
                    onChange={(value) =>
                      setDuration({ minutes: value.minutes, seconds: value.seconds })
                    }
                    className="w-full"
                  />
                </div>

                <div
                  className={cn(
                    "transition-opacity",
                    sessionType !== "shapes" && "pointer-events-none opacity-25",
                  )}
                >
                  <NumberTicker value={targetShapes} onChange={setTargetShapes} min={1} max={100} />
                </div>
              </div>
            </>
          )}

          {formulaType === "caged" && (!supportLearnMode || mode === "practice") && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Note Visibility</label>
              <div className="grid grid-cols-3 gap-2">
                {NOTE_VISIBILITY_OPTIONS.map((option) => {
                  const Icon = option.icon
                  const isSelected = noteVisibility === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setNoteVisibility(option.id)}
                      className={cn(
                        "group relative flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 hover:bg-accent",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-5 transition-transform group-hover:scale-110",
                          isSelected && "text-primary",
                        )}
                      />
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm font-medium">Key</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedKey("random")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-all",
                  selectedKey === "random"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50 hover:bg-accent",
                )}
              >
                <Dices className="size-3.5" />
                Random
              </button>
              {MUSICAL_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-medium transition-all",
                    selectedKey === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 hover:bg-accent",
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {!hideShapes && (!supportLearnMode || mode === "practice") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Shapes</label>
                <button
                  type="button"
                  onClick={selectAllShapes}
                  className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                >
                  Select all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: shapeCount }, (_, i) => i + 1).map((shape) => {
                  const isSelected = selectedShapes.includes(shape)
                  return (
                    <button
                      key={shape}
                      type="button"
                      onClick={() => toggleShape(shape)}
                      className={cn(
                        "group relative flex size-12 items-center justify-center rounded-lg border transition-all",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50 hover:bg-accent",
                      )}
                    >
                      <Music
                        className={cn(
                          "size-4 transition-all",
                          isSelected
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      <span
                        className={cn(
                          "absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {shape}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="text-muted-foreground text-xs">
                {selectedShapes.length} of {shapeCount} shapes selected
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-border border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleStart}>
            {supportLearnMode && mode === "learn" ? "Start Learning" : "Start Practice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
