import { DerivedSessionStats, PracticeMode, SessionState } from "@/app/scale-trainer/page"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface SessionReviewProps {
  sessionStats: DerivedSessionStats | null
  setSessionState: (state: SessionState) => void
  setPlayedNotes: (notes: Set<string>) => void
  startSession: (mode: PracticeMode) => void
  practiceMode: PracticeMode
}

export const formatTime = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export default function SessionReview({
  sessionStats,
  setSessionState,
  setPlayedNotes,
  startSession,
  practiceMode,
}: SessionReviewProps) {
  if (!sessionStats) {
    return (
      <div>
        <div className="flex h-full flex-col items-center justify-center">
          <Loader2 className="size-10 animate-spin" />
          <span className="text-muted-foreground">Loading session stats...</span>
        </div>
      </div>
    )
  }
  return (
    <>
      <h2 className="text-foreground mb-4 text-2xl font-bold">Session Complete</h2>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Time</span>
          <span className="text-foreground font-medium">
            {formatTime(sessionStats.totalDurationSeconds * 1000)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Shapes Completed</span>
          <span className="text-foreground font-medium">{sessionStats.totalShapes}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Notes Played</span>
          <span className="text-foreground font-medium">{sessionStats.totalNotes}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Shapes/Minute</span>
          <span className="text-foreground font-medium">
            {sessionStats.shapesPerMinute.toFixed(1)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Notes/Second</span>
          <span className="text-foreground font-medium">
            {sessionStats.notesPerSecond.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Button
          className="flex-1"
          onClick={() => {
            setSessionState("idle")
            setPlayedNotes(new Set())
          }}
        >
          Done
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => startSession(practiceMode)}>
          Practice Again
        </Button>
      </div>
    </>
  )
}
