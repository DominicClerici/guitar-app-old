"use client"

import { NOTE_NAMES } from "@/lib/theory"

type PracticeType = "roots" | "chordTones" | "pentatonic"

const TOTAL_KEYS = 3
const GUIDED_ROUNDS = 2

interface PracticeInfoProps {
  practiceType: PracticeType
  keyIndex: number
  handleEnterPractice: () => void
  handleBackToArticle: () => void
}

export default function PracticeInfo({
  practiceType,
  keyIndex,
  handleEnterPractice,
  handleBackToArticle,
}: PracticeInfoProps) {
  const practiceTitle =
    practiceType === "pentatonic"
      ? "CAGED Pentatonic Practice"
      : practiceType === "chordTones"
        ? "CAGED Chord Tones Practice"
        : "CAGED Roots Practice"

  const practiceDescription =
    practiceType === "pentatonic"
      ? "Practice identifying and playing the pentatonic notes (1, 2, 3, 5, 6) for each CAGED shape."
      : practiceType === "chordTones"
        ? "Practice identifying and playing the chord tones (1, 3, 5) for each CAGED shape."
        : "Practice identifying and playing the root notes for each CAGED shape."

  return (
    <div className="mx-auto flex max-w-2xl flex-row items-stretch justify-center gap-4">
      <div className="flex w-[48%] shrink-0 flex-col items-end gap-2 text-right">
        <h2 className="font-display text-2xl font-bold tracking-tight">{practiceTitle}</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          {practiceDescription} You&apos;ll go through guided practice, then test your knowledge,
          and finish with a quiz.
        </p>
      </div>
      <div className="bg-border w-px shrink-0" />
      <div className="flex w-[48%] shrink-0 flex-col items-start gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex size-12 items-center justify-center rounded-xl">
            <span className="font-display text-xl font-bold">{NOTE_NAMES[keyIndex]}</span>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium">Starting Key</p>
            <p className="font-semibold">{NOTE_NAMES[keyIndex]} Major</p>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          You&apos;ll practice in <strong>{TOTAL_KEYS} keys</strong>, with <br />
          <strong>{GUIDED_ROUNDS} guided rounds</strong> per key
        </p>
      </div>
    </div>
  )
}
