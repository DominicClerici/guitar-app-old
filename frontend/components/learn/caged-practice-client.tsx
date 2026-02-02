"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { useStringClassifier, type StablePrediction } from "@/hooks/useStringClassifier"
import {
  CAGED_QUIZ_QUESTIONS,
  CAGED_SHAPE_ORDER,
  CHORD_TONES_QUIZ_QUESTIONS,
  CHORD_TONES_SHAPE_ORDER,
  MINOR_PENTATONIC_QUIZ_QUESTIONS,
  MINOR_PENTATONIC_SHAPE_ORDER,
  shuffleQuestions,
} from "@/lib/caged-practice/practice-data"
import type { PracticePhase, QuizResults } from "@/lib/caged-practice/types"
import {
  type FretboardNote,
  generateFretboardNotes,
  getCAGEDShapeNotes,
  getNotesByDegrees,
  getRootNotes,
  NOTE_NAMES,
  SCALE_FORMULAS,
} from "@/lib/theory"
import { cn } from "@/lib/utils"
import { ArrowRight, CheckCircle2, X } from "lucide-react"

import GuidedPracticePhase from "./practice-phases/guided-practice-phase"
import QuizPhase from "./practice-phases/quiz-phase"
import TestPhase from "./practice-phases/test-phase"

const TOTAL_KEYS = 3
const GUIDED_ROUNDS = 2
const QUIZ_QUESTION_COUNT = 5

type PracticeType = "roots" | "chordTones" | "pentatonic"

interface CAGEDPracticeClientProps {
  initialKeyIndex: number
  practiceType?: PracticeType
  onExit: () => void
  onComplete: () => void
}

function ShapeProgressIndicator({
  currentShapeIndex,
  totalShapes,
  shapeOrder,
}: {
  currentShapeIndex: number
  totalShapes: number
  shapeOrder: typeof CAGED_SHAPE_ORDER
}) {
  return (
    <div className="flex items-center gap-1.5">
      {shapeOrder.slice(0, totalShapes).map((shape, index) => (
        <div
          key={shape.shapeName}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg font-bold transition-all duration-300",
            index < currentShapeIndex && "bg-primary text-primary-foreground",
            index === currentShapeIndex &&
              "border-primary bg-primary/15 text-primary scale-110 border-2",
            index > currentShapeIndex && "bg-muted text-muted-foreground",
          )}
        >
          {shape.shapeName}
        </div>
      ))}
    </div>
  )
}

function KeyProgressIndicator({
  keysCompleted,
  totalKeys,
  currentKeyName,
}: {
  keysCompleted: number
  totalKeys: number
  currentKeyName: string
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Current Key
        </span>
        <span className="font-display text-xl font-bold">{currentKeyName} Major</span>
      </div>
      <div className="bg-border h-8 w-px" />
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Progress
        </span>
        <span className="font-display text-xl font-bold tabular-nums">
          {keysCompleted + 1}/{totalKeys}
        </span>
      </div>
    </div>
  )
}

export default function CAGEDPracticeClient({
  initialKeyIndex,
  practiceType = "roots",
  onExit,
  onComplete,
}: CAGEDPracticeClientProps) {
  const shapeOrder =
    practiceType === "pentatonic"
      ? MINOR_PENTATONIC_SHAPE_ORDER
      : practiceType === "chordTones"
        ? CHORD_TONES_SHAPE_ORDER
        : CAGED_SHAPE_ORDER
  const quizQuestionSet =
    practiceType === "pentatonic"
      ? MINOR_PENTATONIC_QUIZ_QUESTIONS
      : practiceType === "chordTones"
        ? CHORD_TONES_QUIZ_QUESTIONS
        : CAGED_QUIZ_QUESTIONS

  const [phase, setPhase] = useState<PracticePhase>("idle")
  const [currentKeyIndex, setCurrentKeyIndex] = useState(initialKeyIndex)
  const [currentShapeIndex, setCurrentShapeIndex] = useState(0)
  const [currentRound, setCurrentRound] = useState(1)
  const [keysCompleted, setKeysCompleted] = useState(0)
  const [playedNotes, setPlayedNotes] = useState<Set<string>>(new Set())
  const [countdownValue, setCountdownValue] = useState(5)
  const [completedShapeName, setCompletedShapeName] = useState<string | null>(null)
  const [quizQuestions, setQuizQuestions] = useState(() =>
    shuffleQuestions(quizQuestionSet).slice(0, QUIZ_QUESTION_COUNT),
  )
  const [usedKeys, setUsedKeys] = useState<number[]>([initialKeyIndex])

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const phaseRef = useRef(phase)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const formula = SCALE_FORMULAS.major
  const fullScale = generateFretboardNotes(currentKeyIndex, formula)
  const filteredNotes =
    practiceType === "pentatonic"
      ? getNotesByDegrees(fullScale, [1, 2, 3, 5, 6])
      : practiceType === "chordTones"
        ? getNotesByDegrees(fullScale, [1, 3, 5])
        : getRootNotes(fullScale)
  const currentShapeName = shapeOrder[currentShapeIndex]?.shapeName || "C"
  const currentShapeNotes = getCAGEDShapeNotes(
    currentShapeName,
    filteredNotes,
    currentKeyIndex,
    undefined,
    formula,
  )
  const currentShapeNotesRef = useRef<FretboardNote[]>([])

  useEffect(() => {
    currentShapeNotesRef.current = currentShapeNotes
  }, [currentShapeNotes])

  const handleStringDetected = useCallback((prediction: StablePrediction) => {
    if (phaseRef.current !== "guided" && phaseRef.current !== "test") return

    const { stringIndex, fret } = prediction
    const shapeNotes = currentShapeNotesRef.current

    const matchingNote = shapeNotes.find(
      (note) => note.stringIndex === stringIndex && note.fretIndex === fret,
    )

    if (matchingNote) {
      setPlayedNotes((prev) => {
        const next = new Set(prev)
        next.add(`${stringIndex}-${fret}`)
        return next
      })
    }
  }, [])

  const { startListening, stopListening, stablePrediction } = useStringClassifier({
    productionMode: true,
    minConfidence: 0.5,
  })

  useEffect(() => {
    if (stablePrediction && stablePrediction.confidence > 0.5) {
      handleStringDetected(stablePrediction)
    }
  }, [stablePrediction, handleStringDetected])

  const getRandomKeyExcluding = useCallback((excludedKeys: number[]) => {
    const availableKeys = NOTE_NAMES.map((_, i) => i).filter((key) => !excludedKeys.includes(key))
    return availableKeys[Math.floor(Math.random() * availableKeys.length)]
  }, [])

  const allNotesPlayed =
    currentShapeNotes.length > 0 &&
    currentShapeNotes.every((note) => playedNotes.has(`${note.stringIndex}-${note.fretIndex}`))

  useEffect(() => {
    if (phase !== "guided" && phase !== "test") return
    if (!allNotesPlayed) return

    setCompletedShapeName(currentShapeName)

    transitionTimerRef.current = setTimeout(() => {
      const nextShapeIndex = currentShapeIndex + 1

      if (nextShapeIndex >= shapeOrder.length) {
        if (phase === "guided") {
          if (currentRound < GUIDED_ROUNDS) {
            setCurrentRound((prev) => prev + 1)
            setCurrentShapeIndex(0)
            setPlayedNotes(new Set())
          } else {
            setPhase("test-intro")
          }
        } else {
          setPhase("key-complete")
        }
      } else {
        setCurrentShapeIndex(nextShapeIndex)
        setPlayedNotes(new Set())
      }
      setCompletedShapeName(null)
    }, 1500)
  }, [allNotesPlayed, currentShapeIndex, currentRound, phase, currentShapeName])

  const handleStartPractice = useCallback(async () => {
    setPhase("countdown")
    setCountdownValue(5)

    await startListening()

    let count = 5
    countdownIntervalRef.current = setInterval(() => {
      count--
      if (count === 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
        }
        setPhase("guided")
      } else {
        setCountdownValue(count)
      }
    }, 1000)
  }, [startListening])

  const handleTestIntroComplete = useCallback(() => {
    setCurrentShapeIndex(0)
    setCurrentRound(1)
    setPlayedNotes(new Set())
    setPhase("test")
  }, [])

  const handleKeyComplete = useCallback(async () => {
    const newKeysCompleted = keysCompleted + 1

    if (newKeysCompleted >= TOTAL_KEYS) {
      stopListening()
      setPhase("quiz")
      setQuizQuestions(shuffleQuestions(quizQuestionSet).slice(0, QUIZ_QUESTION_COUNT))
    } else {
      const nextKey = getRandomKeyExcluding([...usedKeys])
      setUsedKeys((prev) => [...prev, nextKey])
      setCurrentKeyIndex(nextKey)
      setCurrentShapeIndex(0)
      setCurrentRound(1)
      setPlayedNotes(new Set())
      setKeysCompleted(newKeysCompleted)
      setPhase("countdown")
      setCountdownValue(5)

      await startListening()

      let count = 5
      countdownIntervalRef.current = setInterval(() => {
        count--
        if (count === 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
          }
          setPhase("guided")
        } else {
          setCountdownValue(count)
        }
      }, 1000)
    }
  }, [keysCompleted, usedKeys, getRandomKeyExcluding, startListening, stopListening])

  const handleQuizComplete = useCallback((_results: QuizResults) => {
    setPhase("complete")
  }, [])

  const handleQuizRetry = useCallback(() => {
    setQuizQuestions(shuffleQuestions(quizQuestionSet).slice(0, QUIZ_QUESTION_COUNT))
  }, [quizQuestionSet])

  const handleExit = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
    }
    stopListening()
    onExit()
  }, [onExit, stopListening])

  const handleComplete = useCallback(() => {
    onComplete()
  }, [onComplete])

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
      stopListening()
    }
  }, [stopListening])

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

  if (phase === "idle") {
    return (
      <div className="flex flex-col items-center gap-8 py-12">
        <div className="max-w-md space-y-4 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight">{practiceTitle}</h2>
          <p className="text-muted-foreground">
            {practiceDescription} You&apos;ll go through guided practice, then test your knowledge,
            and finish with a quiz.
          </p>
        </div>

        <div className="bg-card flex flex-col items-center gap-4 rounded-2xl border p-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex size-12 items-center justify-center rounded-xl">
              <span className="font-display text-xl font-bold">{NOTE_NAMES[currentKeyIndex]}</span>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Starting Key</p>
              <p className="font-semibold">{NOTE_NAMES[currentKeyIndex]} Major</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-xl px-4 py-3 text-center">
            <p className="text-muted-foreground text-sm">
              You&apos;ll practice in <strong>{TOTAL_KEYS} keys</strong>, with{" "}
              <strong>{GUIDED_ROUNDS} guided rounds</strong> per key
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="lg" onClick={handleExit}>
            Cancel
          </Button>
          <Button size="lg" onClick={handleStartPractice}>
            Start Practice
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (phase === "countdown") {
    return (
      <div className="bg-background/60 absolute inset-0 z-50 flex flex-col items-center justify-center gap-4">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="border-primary/20 absolute size-32 animate-ping rounded-full border-2"
            style={{ animationDuration: "1s" }}
          />
          <div
            className="border-primary/10 absolute size-48 animate-ping rounded-full border"
            style={{ animationDuration: "1s", animationDelay: "0.2s" }}
          />
        </div>

        <span className="text-muted-foreground relative z-10 text-sm font-semibold tracking-[0.3em] uppercase">
          Get Ready
        </span>

        <div className="relative z-10 flex size-32 items-center justify-center">
          <div className="from-primary/20 to-primary/5 absolute inset-0 rounded-full bg-gradient-to-br" />
          <span
            key={countdownValue}
            className="font-display animate-scale-in text-7xl font-bold tabular-nums"
          >
            {countdownValue}
          </span>
        </div>

        <p className="text-muted-foreground relative z-10 text-sm">
          Position your hands on the fretboard
        </p>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleExit}
          className="text-muted-foreground relative z-10 mt-4"
        >
          <X className="size-4" />
          Cancel
        </Button>
      </div>
    )
  }

  if (phase === "guided") {
    return (
      <div className="relative flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <ShapeProgressIndicator
            currentShapeIndex={currentShapeIndex}
            totalShapes={shapeOrder.length}
            shapeOrder={shapeOrder}
          />
          <KeyProgressIndicator
            keysCompleted={keysCompleted}
            totalKeys={TOTAL_KEYS}
            currentKeyName={NOTE_NAMES[currentKeyIndex]}
          />
        </div>

        <GuidedPracticePhase
          currentShapeName={currentShapeName}
          currentShapeNotes={currentShapeNotes}
          playedNotes={playedNotes}
          currentRound={currentRound}
          totalRounds={GUIDED_ROUNDS}
          currentShapeIndex={currentShapeIndex}
          totalShapes={shapeOrder.length}
          practiceType={practiceType}
        />

        {completedShapeName && (
          <div className="animate-fade-in bg-card absolute inset-x-0 bottom-24 mx-auto flex w-fit items-center gap-2 rounded-full border px-6 py-3 shadow-lg">
            <div className="from-primary/20 to-primary/5 flex size-8 items-center justify-center rounded-full bg-gradient-to-br">
              <CheckCircle2 className="text-primary size-5" />
            </div>
            <span className="text-lg font-medium">
              <span className="text-primary">{completedShapeName}</span> Complete!
            </span>
          </div>
        )}

        <div className="flex justify-center">
          <Button variant="ghost" onClick={handleExit}>
            <X className="size-4" />
            Exit Practice
          </Button>
        </div>
      </div>
    )
  }

  if (phase === "test-intro") {
    return (
      <div className="flex flex-col items-center justify-center gap-8 py-16">
        <div className="from-primary to-primary/80 flex size-20 items-center justify-center rounded-full bg-gradient-to-br">
          <CheckCircle2 className="text-primary-foreground size-10" />
        </div>

        <div className="max-w-md space-y-3 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight">Great Progress!</h2>
          <p className="text-muted-foreground text-lg">
            Now let&apos;s test what you&apos;ve learned. The notes will be hidden - play them from
            memory and they&apos;ll appear when you find them.
          </p>
        </div>

        <Button size="lg" onClick={handleTestIntroComplete}>
          Start Test
          <ArrowRight className="size-4" />
        </Button>
      </div>
    )
  }

  if (phase === "test") {
    return (
      <div className="relative flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <ShapeProgressIndicator
            currentShapeIndex={currentShapeIndex}
            totalShapes={shapeOrder.length}
            shapeOrder={shapeOrder}
          />
          <KeyProgressIndicator
            keysCompleted={keysCompleted}
            totalKeys={TOTAL_KEYS}
            currentKeyName={NOTE_NAMES[currentKeyIndex]}
          />
        </div>

        <TestPhase
          currentShapeName={currentShapeName}
          currentShapeNotes={currentShapeNotes}
          playedNotes={playedNotes}
          currentShapeIndex={currentShapeIndex}
          totalShapes={shapeOrder.length}
          practiceType={practiceType}
        />

        {completedShapeName && (
          <div className="animate-fade-in bg-card absolute inset-x-0 bottom-24 mx-auto flex w-fit items-center gap-2 rounded-full border px-6 py-3 shadow-lg">
            <div className="from-primary/20 to-primary/5 flex size-8 items-center justify-center rounded-full bg-gradient-to-br">
              <CheckCircle2 className="text-primary size-5" />
            </div>
            <span className="text-lg font-medium">
              <span className="text-primary">{completedShapeName}</span> Found!
            </span>
          </div>
        )}

        <div className="flex justify-center">
          <Button variant="ghost" onClick={handleExit}>
            <X className="size-4" />
            Exit Practice
          </Button>
        </div>
      </div>
    )
  }

  if (phase === "key-complete") {
    const isLastKey = keysCompleted + 1 >= TOTAL_KEYS

    return (
      <div className="flex flex-col items-center justify-center gap-8 py-16">
        <div className="from-primary to-primary/80 flex size-20 items-center justify-center rounded-full bg-gradient-to-br">
          <CheckCircle2 className="text-primary-foreground size-10" />
        </div>

        <div className="max-w-md space-y-3 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            {NOTE_NAMES[currentKeyIndex]} Major Complete!
          </h2>
          <p className="text-muted-foreground text-lg">
            {isLastKey
              ? "You've completed all keys! Time for a quick knowledge check."
              : `Great job! Let's continue with a new key.`}
          </p>
        </div>

        <div className="bg-card flex items-center gap-6 rounded-2xl border px-8 py-5">
          <div className="flex flex-col items-center gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Keys Completed
            </span>
            <span className="font-display text-3xl font-bold tabular-nums">
              {keysCompleted + 1}/{TOTAL_KEYS}
            </span>
          </div>
        </div>

        <Button size="lg" onClick={handleKeyComplete}>
          {isLastKey ? "Start Quiz" : "Next Key"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    )
  }

  if (phase === "quiz") {
    return (
      <div className="py-4">
        <QuizPhase
          questions={quizQuestions}
          onComplete={handleQuizComplete}
          onRetry={handleQuizRetry}
        />
      </div>
    )
  }

  if (phase === "complete") {
    return (
      <div className="flex flex-col items-center justify-center gap-8 py-16">
        <div className="relative">
          <div className="bg-primary/20 absolute inset-0 animate-ping rounded-full" />
          <div className="from-primary to-primary/80 relative flex size-24 items-center justify-center rounded-full bg-gradient-to-br">
            <svg className="text-primary-foreground size-12" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6L9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="max-w-md space-y-3 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">Practice Complete!</h2>
          <p className="text-muted-foreground text-lg">
            Great work! You&apos;ve successfully practiced the CAGED{" "}
            {practiceType === "pentatonic"
              ? "pentatonic"
              : practiceType === "chordTones"
                ? "chord tones"
                : "roots"}{" "}
            system across multiple keys.
          </p>
        </div>

        <div className="bg-card flex items-center gap-6 rounded-2xl border px-8 py-5">
          <div className="flex flex-col items-center gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Keys Practiced
            </span>
            <span className="font-display text-3xl font-bold">{TOTAL_KEYS}</span>
          </div>
          <div className="bg-border h-12 w-px" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Shapes
            </span>
            <span className="font-display text-3xl font-bold">{shapeOrder.length}</span>
          </div>
        </div>

        <Button
          size="lg"
          className="h-14 rounded-2xl px-10 text-lg font-semibold"
          onClick={handleComplete}
        >
          Done
        </Button>
      </div>
    )
  }

  return null
}
