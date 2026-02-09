"use client"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import { Badge } from "@/components/ui/badge"
import type { FretboardNote } from "@/lib/theory"
import { getNoteName } from "@/lib/theory"
import { cn } from "@/lib/utils"
import { EyeOff, Sparkles } from "lucide-react"

interface TestPhaseProps {
  currentShapeName: string
  currentShapeNotes: FretboardNote[]
  playedNotes: Set<string>
  wrongNote: { stringIndex: number; fretIndex: number } | null
  wrongNoteFading?: boolean
  currentShapeIndex: number
  totalShapes: number
  practiceType?: "roots" | "chordTones" | "pentatonic"
}

export default function TestPhase({
  currentShapeName,
  currentShapeNotes,
  playedNotes,
  wrongNote,
  wrongNoteFading = false,
  currentShapeIndex,
  totalShapes,
  practiceType = "roots",
}: TestPhaseProps) {
  const markers: Marker[] = currentShapeNotes.map((note) => {
    const noteKey = `${note.stringIndex}-${note.fretIndex}`
    const isPlayed = playedNotes.has(noteKey)

    const getMarkerType = () => {
      if (isPlayed) return "played"
      if ((practiceType === "chordTones" || practiceType === "pentatonic") && note.degree !== 1)
        return "chord-tone-hidden"
      return "root-hidden"
    }

    return {
      stringIndex: note.stringIndex,
      fretIndex: note.fretIndex,
      type: getMarkerType(),
      label: getNoteName(note.noteIndex),
      degree: note.degree,
    }
  })

  if (wrongNote) {
    markers.push({
      stringIndex: wrongNote.stringIndex,
      fretIndex: wrongNote.fretIndex,
      type: wrongNoteFading ? "wrong-fading" : "wrong",
      label: "",
    })
  }

  const notesFound = playedNotes.size
  const totalNotes = currentShapeNotes.length

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card relative overflow-hidden rounded-2xl border">
        <div className="from-primary/5 absolute inset-0 bg-gradient-to-br via-transparent to-transparent" />

        <div className="absolute inset-0 opacity-[0.02]">
          <svg className="h-full w-full" preserveAspectRatio="none">
            <defs>
              <pattern id="test-dots" patternUnits="userSpaceOnUse" width="16" height="16">
                <circle cx="2" cy="2" r="1" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#test-dots)" />
          </svg>
        </div>

        <div className="relative z-10 flex items-center justify-between p-5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge className="gap-1.5 px-3 py-1">
                <EyeOff className="size-3.5" />
                Test Mode
              </Badge>
              <Badge variant="outline" className="border-primary/30 bg-primary/5 gap-1.5 px-3 py-1">
                <Sparkles className="size-3.5" />
                Notes Hidden
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Shape
              </span>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-bold">{currentShapeName}</span>
                <span className="text-muted-foreground text-sm">
                  ({currentShapeIndex + 1}/{totalShapes})
                </span>
              </div>
            </div>

            <div className="bg-border h-10 w-px" />

            <div className="flex flex-col items-end gap-0.5">
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                Found
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-display text-2xl font-bold tabular-nums">{notesFound}</span>
                <span className="text-muted-foreground text-lg">/</span>
                <span className="text-muted-foreground font-display text-2xl font-bold tabular-nums">
                  {totalNotes}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 px-5 pb-4">
          <div className="flex gap-1">
            {currentShapeNotes.map((note) => {
              const noteKey = `${note.stringIndex}-${note.fretIndex}`
              const isPlayed = playedNotes.has(noteKey)
              return (
                <div
                  key={noteKey}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-all duration-300",
                    isPlayed ? "bg-primary" : "bg-muted/50",
                  )}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="transition-opacity duration-300">
        <Fretboard markers={markers} className="w-full" />
      </div>

      <p className="text-muted-foreground text-center text-sm">
        Play the{" "}
        {practiceType === "pentatonic"
          ? "pentatonic notes"
          : practiceType === "chordTones"
            ? "chord tones"
            : "root notes"}{" "}
        from memory - they will appear when you find them
      </p>
    </div>
  )
}
