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

export type PracticeType = "roots" | "chordTones" | "pentatonic" | "majorScale"

export type PracticeSessionKey = {
  keyIndex: number
  rounds: number
}

export type PracticeStep = {
  type: "practice"
  id: string
  keys: PracticeSessionKey[]
  mode: "guided" | "test"
  shapes?: CAGEDShapeName[]
  showRootsInTest?: boolean
}

export type ArticleStep = {
  type: "article"
  id: string
  component: string
  retryStepId?: string
}

export type QuizStep = {
  type: "quiz"
  id: string
}

export type CompleteStep = {
  type: "complete"
  id: string
}

export type FlowStep = PracticeStep | ArticleStep | QuizStep | CompleteStep

export type PracticeFlowConfig = {
  practiceType: PracticeType
  steps: FlowStep[]
}

export type SubPhase =
  | "idle"
  | "countdown"
  | "playing"
  | "key-complete"
  | "article"
  | "quiz"
  | "complete"

export type NoteVisibility = "all" | "roots" | "hidden"
