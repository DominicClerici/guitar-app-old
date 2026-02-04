"use client"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import { Badge } from "@/components/ui/badge"
import type { FretboardNote } from "@/lib/theory"
import { getNoteName } from "@/lib/theory"
import { cn } from "@/lib/utils"
import { Eye } from "lucide-react"

interface GuidedPracticePhaseProps {
  currentShapeName: string
  currentShapeNotes: FretboardNote[]
  playedNotes: Set<string>
  wrongNote: { stringIndex: number; fretIndex: number } | null
  currentRound: number
  totalRounds: number
  currentShapeIndex: number
  totalShapes: number
  practiceType?: "roots" | "chordTones" | "pentatonic"
}

export default function GuidedPracticePhase({
  currentShapeName,
  currentShapeNotes,
  playedNotes,
  wrongNote,
  currentRound,
  totalRounds,
  currentShapeIndex,
  totalShapes,
  practiceType = "roots",
}: GuidedPracticePhaseProps) {
  const markers: Marker[] = currentShapeNotes.map((note) => {
    const noteKey = `${note.stringIndex}-${note.fretIndex}`
    const isPlayed = playedNotes.has(noteKey)

    const getMarkerType = () => {
      if (isPlayed) return "played"
      if ((practiceType === "chordTones" || practiceType === "pentatonic") && note.degree !== 1)
        return "chord-tone"
      return "root"
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
      type: "wrong",
      label: "",
    })
  }

  const notesPlayed = playedNotes.size
  const totalNotes = currentShapeNotes.length

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card relative overflow-hidden rounded-2xl border">
        <div className="absolute inset-0 opacity-[0.02]">
          <svg className="h-full w-full" preserveAspectRatio="none">
            <defs>
              <pattern id="guided-grid" patternUnits="userSpaceOnUse" width="24" height="24">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#guided-grid)" />
          </svg>
        </div>

        <div className="relative z-10 flex items-center justify-between p-5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                <Eye className="size-3.5" />
                Guided Practice
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                Round {currentRound} of {totalRounds}
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
                Notes
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-display text-2xl font-bold tabular-nums">{notesPlayed}</span>
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
                    isPlayed ? "bg-primary" : "bg-muted",
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
        Play each highlighted{" "}
        {practiceType === "pentatonic"
          ? "pentatonic note"
          : practiceType === "chordTones"
            ? "chord tone"
            : "root note"}{" "}
        on your guitar to progress
      </p>
    </div>
  )
}
