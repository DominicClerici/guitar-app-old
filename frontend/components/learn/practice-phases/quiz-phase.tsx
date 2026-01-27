"use client"

import QuizContainer from "@/components/quiz/quiz-container"
import type { QuizQuestion, QuizResults } from "@/lib/caged-practice/types"

interface QuizPhaseProps {
  questions: QuizQuestion[]
  onComplete: (results: QuizResults) => void
  onRetry?: () => void
}

export default function QuizPhase({ questions, onComplete, onRetry }: QuizPhaseProps) {
  return (
    <div className="py-4">
      <div className="mb-8 text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight">Knowledge Check</h2>
        <p className="text-muted-foreground mt-2">
          Test your understanding of the CAGED system concepts
        </p>
      </div>

      <QuizContainer questions={questions} onComplete={onComplete} onRetry={onRetry} />
    </div>
  )
}
