"use client"

import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import type { QuizQuestion, QuizResults } from "@/lib/caged-practice/types"
import { cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"

import QuizQuestionComponent from "./quiz-question"
import QuizResultsComponent from "./quiz-results"

interface QuizContainerProps {
  questions: QuizQuestion[]
  onComplete: (results: QuizResults) => void
  onRetry?: () => void
  className?: string
}

export default function QuizContainer({
  questions,
  onComplete,
  onRetry,
  className,
}: QuizContainerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(new Map())
  const [showFeedback, setShowFeedback] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [results, setResults] = useState<QuizResults | null>(null)

  const currentQuestion = questions[currentQuestionIndex]
  const selectedAnswer = answers.get(currentQuestion?.id ?? "")
  const hasAnswered = selectedAnswer !== undefined
  const isLastQuestion = currentQuestionIndex === questions.length - 1

  const handleSelectAnswer = useCallback(
    (optionId: string) => {
      if (showFeedback) return
      setAnswers((prev) => {
        const next = new Map(prev)
        next.set(currentQuestion.id, optionId)
        return next
      })
    },
    [currentQuestion?.id, showFeedback],
  )

  const handleSubmit = useCallback(() => {
    if (!hasAnswered) return

    setShowFeedback(true)

    setTimeout(() => {
      if (isLastQuestion) {
        const correctCount = questions.filter((q) => answers.get(q.id) === q.correctAnswerId).length
        const incorrectIds = questions
          .filter((q) => answers.get(q.id) !== q.correctAnswerId)
          .map((q) => q.id)

        const quizResults: QuizResults = {
          totalQuestions: questions.length,
          correctAnswers: correctCount,
          incorrectAnswers: incorrectIds,
        }

        setResults(quizResults)
        setIsComplete(true)
      } else {
        setCurrentQuestionIndex((prev) => prev + 1)
        setShowFeedback(false)
      }
    }, 1200)
  }, [hasAnswered, isLastQuestion, questions, answers])

  const handleContinue = useCallback(() => {
    if (results) {
      onComplete(results)
    }
  }, [results, onComplete])

  const handleRetry = useCallback(() => {
    setCurrentQuestionIndex(0)
    setAnswers(new Map())
    setShowFeedback(false)
    setIsComplete(false)
    setResults(null)
    onRetry?.()
  }, [onRetry])

  if (isComplete && results) {
    return (
      <div className={cn("animate-fade-in", className)}>
        <QuizResultsComponent
          results={results}
          onContinue={handleContinue}
          onRetry={onRetry ? handleRetry : undefined}
        />
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      <div className="animate-fade-in">
        <QuizQuestionComponent
          question={currentQuestion}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={questions.length}
          selectedAnswer={selectedAnswer ?? null}
          onSelectAnswer={handleSelectAnswer}
          isSubmitted={showFeedback}
          showFeedback={showFeedback}
        />
      </div>

      <div className="mx-auto flex w-full max-w-2xl justify-end">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!hasAnswered || showFeedback}
          className="min-w-32"
        >
          {isLastQuestion ? "Finish" : "Next"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
