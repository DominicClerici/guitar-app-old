"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  useSpectrogramClassifier,
  type SpectrogramPredictionResult,
} from "@/hooks/useSpectrogramClassifier"
import {
  CAGED_QUIZ_QUESTIONS,
  CAGED_SHAPE_ORDER,
  CHORD_TONES_QUIZ_QUESTIONS,
  CHORD_TONES_SHAPE_ORDER,
  MINOR_PENTATONIC_QUIZ_QUESTIONS,
  MINOR_PENTATONIC_SHAPE_ORDER,
  shuffleQuestions,
} from "@/lib/caged-practice/practice-data"
import type {
  ArticleStep,
  FlowStep,
  PracticeFlowConfig,
  PracticeStep,
  PracticeType,
  QuizResults,
  SubPhase,
} from "@/lib/caged-practice/types"
import {
  generateFretboardNotes,
  getCAGEDShapeNotes,
  getNotesByDegrees,
  getRootNotes,
  NOTE_NAMES,
  SCALE_FORMULAS,
  type FretboardNote,
} from "@/lib/theory"
import { cn } from "@/lib/utils"
import { ArrowRight, CheckCircle2, ListChecks, X } from "lucide-react"

import GuidedPracticePhase from "./practice-phases/guided-practice-phase"
import QuizPhase from "./practice-phases/quiz-phase"
import ShortArticlePhase from "./practice-phases/short-article-phase"
import TestPhase from "./practice-phases/test-phase"

const QUIZ_QUESTION_COUNT = 5
const WRONG_NOTE_CONSECUTIVE_THRESHOLD = 5
const CORRECT_NOTE_CONSECUTIVE_THRESHOLD = 2
const WRONG_NOTE_FADE_MS = 300
const WRONG_NOTE_IDLE_TIMEOUT_MS = 1000

interface CAGEDPracticeClientProps {
  initialKeyIndex: number
  practiceType?: PracticeType
  flowConfig?: PracticeFlowConfig
  autoStart?: boolean
  onExit: () => void
  onComplete: () => void
  initialStepIndex?: number
  onModuleComplete?: (moduleId: string) => void
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

function FlowOverview({ steps }: { steps: FlowStep[] }) {
  const practiceSteps = steps.filter((s) => s.type === "practice") as PracticeStep[]
  const totalPracticeKeys = practiceSteps.reduce((sum, s) => sum + s.keys.length, 0)
  const totalRounds = practiceSteps.reduce(
    (sum, s) => sum + s.keys.reduce((kSum, k) => kSum + k.rounds, 0),
    0,
  )
  const hasTest = practiceSteps.some((s) => s.mode === "test")
  const hasQuiz = steps.some((s) => s.type === "quiz")

  return (
    <div className="bg-muted/50 flex flex-wrap items-center justify-center gap-2 rounded-xl px-4 py-3">
      <Badge variant="secondary" className="gap-1.5">
        <ListChecks className="size-3" />
        {totalPracticeKeys} {totalPracticeKeys === 1 ? "key" : "keys"}
      </Badge>
      <Badge variant="secondary">{totalRounds} rounds</Badge>
      {hasTest && <Badge variant="outline">Test</Badge>}
      {hasQuiz && <Badge variant="outline">Quiz</Badge>}
    </div>
  )
}

export default function CAGEDPracticeClient({
  initialKeyIndex,
  practiceType = "roots",
  flowConfig,
  autoStart = false,
  onExit,
  onComplete,
  initialStepIndex = 0,
  onModuleComplete,
}: CAGEDPracticeClientProps) {
  const effectivePracticeType = flowConfig?.practiceType ?? practiceType

  const shapeOrder =
    effectivePracticeType === "pentatonic"
      ? MINOR_PENTATONIC_SHAPE_ORDER
      : effectivePracticeType === "chordTones"
        ? CHORD_TONES_SHAPE_ORDER
        : CAGED_SHAPE_ORDER
  const quizQuestionSet =
    effectivePracticeType === "pentatonic"
      ? MINOR_PENTATONIC_QUIZ_QUESTIONS
      : effectivePracticeType === "chordTones"
        ? CHORD_TONES_QUIZ_QUESTIONS
        : CAGED_QUIZ_QUESTIONS

  // --- Step-based flow state ---
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex)
  const [subPhase, setSubPhase] = useState<SubPhase>("idle")

  const currentStep = flowConfig?.steps[currentStepIndex] ?? null

  // --- Practice state ---
  const [currentKeyIndex, setCurrentKeyIndex] = useState(initialKeyIndex)
  const [currentShapeIndex, setCurrentShapeIndex] = useState(0)
  const [currentRound, setCurrentRound] = useState(1)
  const [keysCompleted, setKeysCompleted] = useState(0)
  const [playedNotes, setPlayedNotes] = useState<Set<string>>(new Set())
  const [wrongNote, setWrongNote] = useState<{ stringIndex: number; fretIndex: number } | null>(
    null,
  )
  const [wrongNoteFading, setWrongNoteFading] = useState(false)
  const [countdownValue, setCountdownValue] = useState(5)
  const [completedShapeName, setCompletedShapeName] = useState<string | null>(null)
  const [quizQuestions, setQuizQuestions] = useState(() =>
    shuffleQuestions(quizQuestionSet).slice(0, QUIZ_QUESTION_COUNT),
  )

  const currentPracticeStep =
    currentStep?.type === "practice" ? (currentStep as PracticeStep) : null
  const totalKeysInStep = currentPracticeStep?.keys.length ?? 1
  const currentRoundsForKey = currentPracticeStep?.keys[keysCompleted]?.rounds ?? 2

  // When a step specifies a subset of shapes, filter the full shape order down
  const activeShapeOrder = useMemo(() => {
    if (!currentPracticeStep?.shapes) return shapeOrder
    return shapeOrder.filter((s) => currentPracticeStep.shapes!.includes(s.shapeName))
  }, [currentPracticeStep?.shapes, shapeOrder])

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wrongNoteTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wrongNoteFadeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const wrongNoteConsecutiveRef = useRef(0)
  const lastWrongNoteRef = useRef<string | null>(null)
  const correctNoteConsecutiveRef = useRef(0)
  const lastCorrectNoteRef = useRef<string | null>(null)
  const subPhaseRef = useRef(subPhase)

  useEffect(() => {
    subPhaseRef.current = subPhase
  }, [subPhase])

  const formula = SCALE_FORMULAS.major
  const fullScale = generateFretboardNotes(currentKeyIndex, formula)
  const filteredNotes =
    effectivePracticeType === "pentatonic"
      ? getNotesByDegrees(fullScale, [1, 2, 3, 5, 6])
      : effectivePracticeType === "chordTones"
        ? getNotesByDegrees(fullScale, [1, 3, 5])
        : getRootNotes(fullScale)
  const currentShapeName = activeShapeOrder[currentShapeIndex]?.shapeName || "C"
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

  const handleStringDetected = useCallback((prediction: SpectrogramPredictionResult) => {
    if (subPhaseRef.current !== "playing") return

    const { stringIndex, fret } = prediction
    const shapeNotes = currentShapeNotesRef.current
    const noteKey = `${stringIndex}-${fret}`

    const fadeOutWrongNote = () => {
      setWrongNoteFading(true)
      if (wrongNoteFadeTimerRef.current) clearTimeout(wrongNoteFadeTimerRef.current)
      wrongNoteFadeTimerRef.current = setTimeout(() => {
        setWrongNote(null)
        setWrongNoteFading(false)
        wrongNoteFadeTimerRef.current = null
      }, WRONG_NOTE_FADE_MS)
    }

    const matchingNote = shapeNotes.find(
      (note) => note.stringIndex === stringIndex && note.fretIndex === fret,
    )

    if (matchingNote) {
      if (lastCorrectNoteRef.current === noteKey) {
        correctNoteConsecutiveRef.current++
      } else {
        correctNoteConsecutiveRef.current = 1
        lastCorrectNoteRef.current = noteKey
      }

      if (correctNoteConsecutiveRef.current >= CORRECT_NOTE_CONSECUTIVE_THRESHOLD) {
        setPlayedNotes((prev) => {
          const next = new Set(prev)
          next.add(noteKey)
          return next
        })
      }

      wrongNoteConsecutiveRef.current = 0
      lastWrongNoteRef.current = null
      if (wrongNoteTimerRef.current) {
        clearTimeout(wrongNoteTimerRef.current)
        wrongNoteTimerRef.current = null
      }
      fadeOutWrongNote()
    } else {
      correctNoteConsecutiveRef.current = 0
      lastCorrectNoteRef.current = null

      if (lastWrongNoteRef.current === noteKey) {
        wrongNoteConsecutiveRef.current++
      } else {
        wrongNoteConsecutiveRef.current = 1
        lastWrongNoteRef.current = noteKey
        fadeOutWrongNote()
      }

      if (wrongNoteConsecutiveRef.current > WRONG_NOTE_CONSECUTIVE_THRESHOLD) {
        if (wrongNoteFadeTimerRef.current) {
          clearTimeout(wrongNoteFadeTimerRef.current)
          wrongNoteFadeTimerRef.current = null
        }
        setWrongNoteFading(false)
        setWrongNote({ stringIndex, fretIndex: fret })

        if (wrongNoteTimerRef.current) {
          clearTimeout(wrongNoteTimerRef.current)
        }
        wrongNoteTimerRef.current = setTimeout(() => {
          fadeOutWrongNote()
          wrongNoteTimerRef.current = null
        }, WRONG_NOTE_IDLE_TIMEOUT_MS)
      }
    }
  }, [])

  const {
    startListening,
    stopListening,
    prediction: spectrogramPrediction,
  } = useSpectrogramClassifier({
    minConfidence: 0.97,
  })

  useEffect(() => {
    if (spectrogramPrediction && spectrogramPrediction.confidence > 0.97) {
      handleStringDetected(spectrogramPrediction)
    }
  }, [spectrogramPrediction, handleStringDetected])

  const allNotesPlayed =
    currentShapeNotes.length > 0 &&
    currentShapeNotes.every((note) => playedNotes.has(`${note.stringIndex}-${note.fretIndex}`))

  const currentStepMode = currentPracticeStep?.mode ?? "guided"

  const resetPracticeState = useCallback(() => {
    setCurrentShapeIndex(0)
    setCurrentRound(1)
    setKeysCompleted(0)
    setPlayedNotes(new Set())
    setWrongNote(null)
    setWrongNoteFading(false)
    setCompletedShapeName(null)
    wrongNoteConsecutiveRef.current = 0
    lastWrongNoteRef.current = null
    correctNoteConsecutiveRef.current = 0
    lastCorrectNoteRef.current = null
  }, [])

  const startCountdown = useCallback(async () => {
    setSubPhase("countdown")
    setCountdownValue(5)

    await startListening()

    let count = 5
    countdownIntervalRef.current = setInterval(() => {
      count--
      if (count === 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
        }
        setSubPhase("playing")
      } else {
        setCountdownValue(count)
      }
    }, 1000)
  }, [startListening])

  const advanceToStep = useCallback(
    async (stepIndex: number) => {
      if (!flowConfig || stepIndex >= flowConfig.steps.length) {
        stopListening()
        setSubPhase("complete")
        return
      }

      const nextStep = flowConfig.steps[stepIndex]
      setCurrentStepIndex(stepIndex)

      if (nextStep.type === "practice") {
        const practiceStep = nextStep as PracticeStep
        resetPracticeState()
        setCurrentKeyIndex(practiceStep.keys[0].keyIndex)
        await startCountdown()
      } else if (nextStep.type === "article") {
        stopListening()
        setSubPhase("article")
      } else if (nextStep.type === "quiz") {
        stopListening()
        setQuizQuestions(shuffleQuestions(quizQuestionSet).slice(0, QUIZ_QUESTION_COUNT))
        setSubPhase("quiz")
      } else if (nextStep.type === "complete") {
        stopListening()
        setSubPhase("complete")
      }
    },
    [flowConfig, stopListening, resetPracticeState, startCountdown, quizQuestionSet],
  )

  useEffect(() => {
    if (subPhase !== "playing") return
    if (!allNotesPlayed) return

    setCompletedShapeName(currentShapeName)

    transitionTimerRef.current = setTimeout(() => {
      const nextShapeIndex = currentShapeIndex + 1

      if (nextShapeIndex >= activeShapeOrder.length) {
        if (currentStepMode === "guided") {
          if (currentRound < currentRoundsForKey) {
            setCurrentRound((prev) => prev + 1)
            setCurrentShapeIndex(0)
            setPlayedNotes(new Set())
          } else {
            const newKeysCompleted = keysCompleted + 1
            if (currentPracticeStep && newKeysCompleted < currentPracticeStep.keys.length) {
              setKeysCompleted(newKeysCompleted)
              setSubPhase("key-complete")
            } else {
              if (flowConfig?.steps[currentStepIndex]) {
                onModuleComplete?.(flowConfig.steps[currentStepIndex].id)
              }
              advanceToStep(currentStepIndex + 1)
            }
          }
        } else {
          const newKeysCompleted = keysCompleted + 1
          if (currentPracticeStep && newKeysCompleted < currentPracticeStep.keys.length) {
            setKeysCompleted(newKeysCompleted)
            setSubPhase("key-complete")
          } else {
            if (flowConfig?.steps[currentStepIndex]) {
              onModuleComplete?.(flowConfig.steps[currentStepIndex].id)
            }
            advanceToStep(currentStepIndex + 1)
          }
        }
      } else {
        setCurrentShapeIndex(nextShapeIndex)
        setPlayedNotes(new Set())
      }
      setCompletedShapeName(null)
    }, 1500)
  }, [
    allNotesPlayed,
    currentShapeIndex,
    currentRound,
    subPhase,
    currentShapeName,
    currentRoundsForKey,
    currentStepMode,
    keysCompleted,
    currentPracticeStep,
    currentStepIndex,
    advanceToStep,
    activeShapeOrder.length,
    flowConfig,
    onModuleComplete,
  ])

  const handleStartPractice = useCallback(async () => {
    if (flowConfig) {
      const step = flowConfig.steps[currentStepIndex]
      if (step?.type === "practice") {
        const practiceStep = step as PracticeStep
        setCurrentKeyIndex(practiceStep.keys[0].keyIndex)
        resetPracticeState()
      }
    }
    await startCountdown()
  }, [flowConfig, startCountdown, resetPracticeState, currentStepIndex])

  useEffect(() => {
    if (autoStart && subPhase === "idle") {
      const step = flowConfig?.steps[currentStepIndex]
      if (step?.type === "article") {
        setSubPhase("article")
      } else if (step?.type === "quiz") {
        setQuizQuestions(shuffleQuestions(quizQuestionSet).slice(0, QUIZ_QUESTION_COUNT))
        setSubPhase("quiz")
      } else {
        handleStartPractice()
      }
    }
  }, [autoStart, subPhase, handleStartPractice, currentStepIndex, flowConfig, quizQuestionSet])

  const handleKeyComplete = useCallback(async () => {
    if (!currentPracticeStep) return

    const nextKeyConfig = currentPracticeStep.keys[keysCompleted]
    if (!nextKeyConfig) {
      advanceToStep(currentStepIndex + 1)
      return
    }

    setCurrentKeyIndex(nextKeyConfig.keyIndex)
    setCurrentShapeIndex(0)
    setCurrentRound(1)
    setPlayedNotes(new Set())
    await startCountdown()
  }, [keysCompleted, currentPracticeStep, currentStepIndex, advanceToStep, startCountdown])

  const handleQuizComplete = useCallback(
    (_results: QuizResults) => {
      if (currentStep) {
        onModuleComplete?.(currentStep.id)
      }
      advanceToStep(currentStepIndex + 1)
    },
    [currentStepIndex, advanceToStep, currentStep, onModuleComplete],
  )

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

  const handleArticleContinue = useCallback(() => {
    if (currentStep) {
      onModuleComplete?.(currentStep.id)
    }
    advanceToStep(currentStepIndex + 1)
  }, [currentStepIndex, advanceToStep, currentStep, onModuleComplete])

  const handleArticleRetry = useCallback(() => {
    if (!flowConfig || !currentStep || currentStep.type !== "article") return
    const articleStep = currentStep as ArticleStep
    if (!articleStep.retryStepId) return

    const retryIndex = flowConfig.steps.findIndex((s) => s.id === articleStep.retryStepId)
    if (retryIndex >= 0) {
      advanceToStep(retryIndex)
    }
  }, [flowConfig, currentStep, advanceToStep])

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
      if (wrongNoteTimerRef.current) {
        clearTimeout(wrongNoteTimerRef.current)
      }
      if (wrongNoteFadeTimerRef.current) {
        clearTimeout(wrongNoteFadeTimerRef.current)
      }
      stopListening()
    }
  }, [stopListening])

  const practiceTitle =
    effectivePracticeType === "pentatonic"
      ? "CAGED Pentatonic Practice"
      : effectivePracticeType === "chordTones"
        ? "CAGED Chord Tones Practice"
        : "CAGED Roots Practice"
  const practiceDescription =
    effectivePracticeType === "pentatonic"
      ? "Practice identifying and playing the pentatonic notes (1, 2, 3, 5, 6) for each CAGED shape."
      : effectivePracticeType === "chordTones"
        ? "Practice identifying and playing the chord tones (1, 3, 5) for each CAGED shape."
        : "Practice identifying and playing the root notes for each CAGED shape."

  if (subPhase === "article" && currentStep?.type === "article") {
    const articleStep = currentStep as ArticleStep
    return (
      <ShortArticlePhase
        articleId={articleStep.component}
        onContinue={handleArticleContinue}
        onRetry={articleStep.retryStepId ? handleArticleRetry : undefined}
      />
    )
  }

  if (subPhase === "idle") {
    const firstPracticeStep = flowConfig?.steps.find((s) => s.type === "practice") as
      | PracticeStep
      | undefined
    const startingKeyIndex = firstPracticeStep?.keys[0].keyIndex ?? currentKeyIndex

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
              <span className="font-display text-xl font-bold">{NOTE_NAMES[startingKeyIndex]}</span>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">Starting Key</p>
              <p className="font-semibold">{NOTE_NAMES[startingKeyIndex]} Major</p>
            </div>
          </div>

          {flowConfig ? (
            <FlowOverview steps={flowConfig.steps} />
          ) : (
            <div className="bg-muted/50 rounded-xl px-4 py-3 text-center">
              <p className="text-muted-foreground text-sm">
                You&apos;ll practice in <strong>{totalKeysInStep} keys</strong>, with{" "}
                <strong>{currentRoundsForKey} guided rounds</strong> per key
              </p>
            </div>
          )}
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

  if (subPhase === "countdown") {
    return (
      <div className="relative flex flex-col gap-6">
        <div className="flex items-center justify-between opacity-50">
          <ShapeProgressIndicator
            currentShapeIndex={currentShapeIndex}
            totalShapes={activeShapeOrder.length}
            shapeOrder={activeShapeOrder}
          />
          <KeyProgressIndicator
            keysCompleted={keysCompleted}
            totalKeys={totalKeysInStep}
            currentKeyName={NOTE_NAMES[currentKeyIndex]}
          />
        </div>

        <div className="pointer-events-none opacity-50">
          <GuidedPracticePhase
            currentShapeName={currentShapeName}
            currentShapeNotes={currentShapeNotes}
            playedNotes={playedNotes}
            wrongNote={null}
            currentRound={currentRound}
            totalRounds={currentRoundsForKey}
            currentShapeIndex={currentShapeIndex}
            totalShapes={activeShapeOrder.length}
            practiceType={effectivePracticeType}
          />
        </div>

        <div className="bg-background/80 absolute inset-0 z-50 flex flex-col items-center justify-center gap-4">
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
      </div>
    )
  }

  if (subPhase === "playing" && currentStepMode === "guided") {
    return (
      <div className="relative flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <ShapeProgressIndicator
            currentShapeIndex={currentShapeIndex}
            totalShapes={activeShapeOrder.length}
            shapeOrder={activeShapeOrder}
          />
          <KeyProgressIndicator
            keysCompleted={keysCompleted}
            totalKeys={totalKeysInStep}
            currentKeyName={NOTE_NAMES[currentKeyIndex]}
          />
        </div>

        <GuidedPracticePhase
          currentShapeName={currentShapeName}
          currentShapeNotes={currentShapeNotes}
          playedNotes={playedNotes}
          wrongNote={wrongNote}
          wrongNoteFading={wrongNoteFading}
          currentRound={currentRound}
          totalRounds={currentRoundsForKey}
          currentShapeIndex={currentShapeIndex}
          totalShapes={activeShapeOrder.length}
          practiceType={effectivePracticeType}
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

  if (subPhase === "playing" && currentStepMode === "test") {
    return (
      <div className="relative flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <ShapeProgressIndicator
            currentShapeIndex={currentShapeIndex}
            totalShapes={activeShapeOrder.length}
            shapeOrder={activeShapeOrder}
          />
          <KeyProgressIndicator
            keysCompleted={keysCompleted}
            totalKeys={totalKeysInStep}
            currentKeyName={NOTE_NAMES[currentKeyIndex]}
          />
        </div>

        <TestPhase
          currentShapeName={currentShapeName}
          currentShapeNotes={currentShapeNotes}
          playedNotes={playedNotes}
          wrongNote={wrongNote}
          wrongNoteFading={wrongNoteFading}
          currentShapeIndex={currentShapeIndex}
          totalShapes={activeShapeOrder.length}
          practiceType={effectivePracticeType}
          showRoots={currentPracticeStep?.showRootsInTest}
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

  if (subPhase === "key-complete") {
    const isLastKey = keysCompleted >= totalKeysInStep

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
              ? "You've completed all keys! Moving on to the next step."
              : `Great job! Let's continue with a new key.`}
          </p>
        </div>

        <div className="bg-card flex items-center gap-6 rounded-2xl border px-8 py-5">
          <div className="flex flex-col items-center gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Keys Completed
            </span>
            <span className="font-display text-3xl font-bold tabular-nums">
              {keysCompleted}/{totalKeysInStep}
            </span>
          </div>
        </div>

        <Button size="lg" onClick={handleKeyComplete}>
          {isLastKey ? "Continue" : "Next Key"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    )
  }

  if (subPhase === "quiz") {
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

  if (subPhase === "complete") {
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
            {effectivePracticeType === "pentatonic"
              ? "pentatonic"
              : effectivePracticeType === "chordTones"
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
            <span className="font-display text-3xl font-bold">{totalKeysInStep}</span>
          </div>
          <div className="bg-border h-12 w-px" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Shapes
            </span>
            <span className="font-display text-3xl font-bold">{activeShapeOrder.length}</span>
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
