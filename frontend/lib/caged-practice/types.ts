import type { CAGEDShapeName } from "@/lib/theory"

export type PracticePhase =
  | "idle"
  | "countdown"
  | "guided"
  | "test-intro"
  | "test"
  | "key-complete"
  | "quiz"
  | "complete"

export type PracticeState = {
  phase: PracticePhase
  currentKeyIndex: number
  currentShapeIndex: number
  currentRound: number
  keysCompleted: number
  totalKeys: number
  playedNotes: Set<string>
  isGuidedComplete: boolean
  quizAnswers: Map<string, string>
}

export type QuizOption = {
  id: string
  label: string
}

export type QuizQuestion = {
  id: string
  questionText: string
  questionComponent?: React.ReactNode
  options: QuizOption[]
  correctAnswerId: string
}

export type QuizResults = {
  totalQuestions: number
  correctAnswers: number
  incorrectAnswers: string[]
}

export type ShapeRootConfig = {
  shapeName: CAGEDShapeName
  rootCount: number
}

export type PracticeSession = {
  startedAt: number
  keys: number[]
  guidedAccuracy: number
  testAccuracy: number
  quizScore: number
  totalTime: number
}
