"use client"

import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle } from "lucide-react"

import type { QuizOption, QuizQuestion } from "@/lib/caged-practice/types"

interface QuizQuestionProps {
  question: QuizQuestion
  questionNumber: number
  totalQuestions: number
  selectedAnswer: string | null
  onSelectAnswer: (optionId: string) => void
  isSubmitted: boolean
  showFeedback: boolean
}

function AnswerOption({
  option,
  isSelected,
  isCorrect,
  isIncorrect,
  showFeedback,
  onClick,
  disabled,
}: {
  option: QuizOption
  isSelected: boolean
  isCorrect: boolean
  isIncorrect: boolean
  showFeedback: boolean
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200",
        "hover:border-primary/40 hover:bg-primary/5",
        "focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:outline-none",
        !showFeedback && isSelected && "border-primary bg-primary/10",
        !showFeedback && !isSelected && "border-border bg-card",
        showFeedback && isCorrect && "border-emerald-500 bg-emerald-500/10",
        showFeedback && isIncorrect && "border-destructive bg-destructive/10",
        showFeedback && !isCorrect && !isIncorrect && "border-border/50 bg-card/50 opacity-60",
        disabled && "cursor-not-allowed",
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-colors",
          !showFeedback && isSelected && "border-primary bg-primary text-primary-foreground",
          !showFeedback &&
            !isSelected &&
            "border-muted-foreground/30 bg-muted text-muted-foreground",
          showFeedback && isCorrect && "border-emerald-500 bg-emerald-500 text-white",
          showFeedback && isIncorrect && "border-destructive bg-destructive text-white",
          showFeedback &&
            !isCorrect &&
            !isIncorrect &&
            "border-muted-foreground/20 bg-muted/50 text-muted-foreground/50",
        )}
      >
        {option.id.toUpperCase()}
      </div>

      <span
        className={cn(
          "flex-1 font-medium transition-colors",
          showFeedback && isCorrect && "text-emerald-700 dark:text-emerald-300",
          showFeedback && isIncorrect && "text-destructive",
          showFeedback && !isCorrect && !isIncorrect && "text-muted-foreground/50",
        )}
      >
        {option.label}
      </span>

      {showFeedback && isCorrect && <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />}
      {showFeedback && isIncorrect && <XCircle className="text-destructive size-5 shrink-0" />}
    </button>
  )
}

export default function QuizQuestionComponent({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer,
  isSubmitted,
  showFeedback,
}: QuizQuestionProps) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <span className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
          Question {questionNumber} of {totalQuestions}
        </span>
        <div className="flex gap-1.5">
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                i < questionNumber ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      <div className="mb-8">
        {question.questionComponent || (
          <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            {question.questionText}
          </h2>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {question.options.map((option) => (
          <AnswerOption
            key={option.id}
            option={option}
            isSelected={selectedAnswer === option.id}
            isCorrect={showFeedback && option.id === question.correctAnswerId}
            isIncorrect={
              showFeedback && selectedAnswer === option.id && option.id !== question.correctAnswerId
            }
            showFeedback={showFeedback}
            onClick={() => onSelectAnswer(option.id)}
            disabled={isSubmitted}
          />
        ))}
      </div>
    </div>
  )
}
