"use client"

import { Button } from "@/components/ui/button"
import type { QuizResults } from "@/lib/caged-practice/types"
import { cn } from "@/lib/utils"
import { Award, RefreshCw, Target } from "lucide-react"

interface QuizResultsProps {
  results: QuizResults
  onRetry?: () => void
  onContinue: () => void
}

export default function QuizResultsComponent({ results, onRetry, onContinue }: QuizResultsProps) {
  const percentage = Math.round((results.correctAnswers / results.totalQuestions) * 100)
  const isPerfect = percentage === 100
  const isGood = percentage >= 80
  const isPassing = percentage >= 60

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 py-8">
      <div className="relative">
        <div
          className={cn(
            "absolute inset-0 animate-ping rounded-full opacity-20",
            isPerfect && "bg-emerald-500",
            isGood && !isPerfect && "bg-primary",
            !isGood && isPassing && "bg-amber-500",
            !isPassing && "bg-destructive",
          )}
        />
        <div
          className={cn(
            "relative flex size-24 items-center justify-center rounded-full",
            isPerfect && "bg-gradient-to-br from-emerald-400 to-emerald-600",
            isGood && !isPerfect && "from-primary to-primary/80 bg-gradient-to-br",
            !isGood && isPassing && "bg-gradient-to-br from-amber-400 to-amber-600",
            !isPassing && "from-destructive/80 to-destructive bg-gradient-to-br",
          )}
        >
          {isPerfect ? (
            <Award className="size-12 text-white" />
          ) : (
            <Target className="size-12 text-white" />
          )}
        </div>
      </div>

      <div className="space-y-2 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight">
          {isPerfect && "Perfect Score!"}
          {isGood && !isPerfect && "Great Job!"}
          {!isGood && isPassing && "Good Effort!"}
          {!isPassing && "Keep Practicing!"}
        </h2>
        <p className="text-muted-foreground text-lg">
          {isPerfect && "You've mastered the CAGED roots concepts!"}
          {isGood && !isPerfect && "You have a solid understanding of the CAGED system."}
          {!isGood && isPassing && "You're getting there. Review and try again!"}
          {!isPassing && "Consider reviewing the article before trying again."}
        </p>
      </div>

      <div className="bg-card flex w-full items-center justify-around rounded-2xl border p-6">
        <div className="flex flex-col items-center gap-1">
          <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Score
          </span>
          <span className="font-display text-4xl font-bold tabular-nums">{percentage}%</span>
        </div>
        <div className="bg-border h-12 w-px" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            Correct
          </span>
          <span className="font-display text-4xl font-bold tabular-nums">
            {results.correctAnswers}/{results.totalQuestions}
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button
          size="lg"
          className="h-14 w-full rounded-xl text-lg font-semibold"
          onClick={onContinue}
        >
          {isPassing ? "Complete Practice" : "Finish Anyway"}
        </Button>
        {onRetry && !isPerfect && (
          <Button variant="outline" size="lg" className="h-12 w-full rounded-xl" onClick={onRetry}>
            <RefreshCw className="size-4" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  )
}
