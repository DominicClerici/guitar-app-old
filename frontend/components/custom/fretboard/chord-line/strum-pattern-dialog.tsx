import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useRef, useCallback, useEffect } from "react"
import * as Tone from "tone"
import StrumPatternDetector from "./strum-pattern-detector"
import ManualPatternCreator from "./manual-pattern-creator"
import useFretboardContext from "../fretboard-context"

export type StrumDirection = "up" | "down"

export interface StrumNote {
  position: number
  direction: StrumDirection
}

// Preview controls interface for child components
export interface PreviewControls {
  isPreviewingPattern: boolean
  previewProgress: number
  startPreview: (pattern: StrumNote[]) => Promise<void>
  stopPreview: () => void
}

interface StrumPatternDialogProps {
  setStrumPattern: React.Dispatch<React.SetStateAction<StrumNote[]>>
  strumPattern: StrumNote[]
  bpm: number
}

type RecordingState = "idle" | "countdown" | "recording" | "complete"
type SnapInterval = "4n" | "8n" | "16n" | "32n" | "64n" | null

export default function StrumPatternDialog({
  setStrumPattern,
  strumPattern,
  bpm,
}: StrumPatternDialogProps) {
  const { strumNotes } = useFretboardContext()

  const [activeTab, setActiveTab] = useState<"detect" | "manual">("detect")
  const [recordingState, setRecordingState] = useState<RecordingState>("idle")
  const [originalClicks, setOriginalClicks] = useState<StrumNote[]>([])
  const [snappedClicks, setSnappedClicks] = useState<StrumNote[] | null>(null)
  const [manualClicks, setManualClicks] = useState<StrumNote[]>([])
  const [activeSnapInterval, setActiveSnapInterval] =
    useState<SnapInterval>(null)

  // Shared preview state
  const [isPreviewingPattern, setIsPreviewingPattern] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)

  // Shared preview refs
  const previewPartRef = useRef<Tone.Part | null>(null)
  const previewAnimationRef = useRef<number | null>(null)
  const previewStartTimeRef = useRef<number>(0)

  // Calculate bar duration in milliseconds (4 beats per bar)
  const barDurationMs = (60 / bpm) * 4 * 1000

  // Cleanup function for preview
  const cleanupPreview = useCallback(() => {
    if (previewPartRef.current) {
      previewPartRef.current.stop()
      previewPartRef.current.dispose()
      previewPartRef.current = null
    }
    if (previewAnimationRef.current) {
      cancelAnimationFrame(previewAnimationRef.current)
      previewAnimationRef.current = null
    }
    Tone.getTransport().stop()
    Tone.getTransport().position = 0
    setIsPreviewingPattern(false)
    setPreviewProgress(0)
  }, [])

  // Start preview playback for any pattern
  const startPreview = useCallback(
    async (pattern: StrumNote[]) => {
      if (pattern.length === 0) return

      // Stop any existing preview
      cleanupPreview()

      await Tone.start()
      Tone.getTransport().bpm.value = bpm

      // Bar duration in seconds
      const barDurationSec = (60 / bpm) * 4

      // Build events from the pattern
      const events = pattern.map((note, index) => ({
        time: note.position * barDurationSec,
        direction: note.direction,
        index,
      }))

      type PreviewEvent = {
        time: number
        direction: "up" | "down"
        index: number
      }

      previewPartRef.current = new Tone.Part<PreviewEvent>((_time, event) => {
        // Play open strings with the correct strum direction
        strumNotes(event.direction)
      }, events)

      previewPartRef.current.loop = true
      previewPartRef.current.loopEnd = barDurationSec
      previewPartRef.current.start(0)

      // Record start time and begin progress animation
      previewStartTimeRef.current = performance.now()

      const updatePreviewProgress = () => {
        const elapsed = performance.now() - previewStartTimeRef.current
        const progress = (elapsed % barDurationMs) / barDurationMs
        setPreviewProgress(progress)
        previewAnimationRef.current = requestAnimationFrame(
          updatePreviewProgress
        )
      }
      previewAnimationRef.current = requestAnimationFrame(updatePreviewProgress)

      Tone.getTransport().start()
      setIsPreviewingPattern(true)
    },
    [bpm, barDurationMs, cleanupPreview, strumNotes]
  )

  const stopPreview = useCallback(() => {
    cleanupPreview()
  }, [cleanupPreview])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupPreview()
    }
  }, [cleanupPreview])

  // Preview controls object to pass to children
  const previewControls: PreviewControls = {
    isPreviewingPattern,
    previewProgress,
    startPreview,
    stopPreview,
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Strum Pattern</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogTitle>Strum Pattern</DialogTitle>
        <DialogDescription>
          Create a strum pattern by detecting your clicks or manually placing
          strums.
        </DialogDescription>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "detect" | "manual")}
          className="mt-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger
              disabled={
                recordingState === "countdown" || recordingState === "recording"
              }
              value="detect"
            >
              Detect
            </TabsTrigger>
            <TabsTrigger
              disabled={
                recordingState === "countdown" || recordingState === "recording"
              }
              value="manual"
            >
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detect" className="mt-4">
            <StrumPatternDetector
              setStrumPattern={setStrumPattern}
              bpm={bpm}
              barDurationMs={barDurationMs}
              recordingState={recordingState}
              setRecordingState={setRecordingState}
              originalClicks={originalClicks}
              snappedClicks={snappedClicks}
              activeSnapInterval={activeSnapInterval}
              setOriginalClicks={setOriginalClicks}
              setSnappedClicks={setSnappedClicks}
              setActiveSnapInterval={setActiveSnapInterval}
              previewControls={previewControls}
            />
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <ManualPatternCreator
              setStrumPattern={setStrumPattern}
              bpm={bpm}
              barDurationMs={barDurationMs}
              manualClicks={manualClicks}
              setManualClicks={setManualClicks}
              previewControls={previewControls}
            />
          </TabsContent>
        </Tabs>

        {/* Current saved pattern - shared between both tabs */}
        {strumPattern.length > 0 && (
          <CurrentPatternDisplay
            strumPattern={strumPattern}
            previewControls={previewControls}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// Shared component for displaying the current saved pattern
import { PlayIcon, SquareIcon } from "lucide-react"

function CurrentPatternDisplay({
  strumPattern,
  previewControls,
}: {
  strumPattern: StrumNote[]
  previewControls: PreviewControls
}) {
  const { isPreviewingPattern, previewProgress, startPreview, stopPreview } =
    previewControls

  return (
    <div className="border-t pt-4 mt-4">
      <div className="text-sm font-medium mb-2 flex items-center justify-between">
        <span>Current Pattern:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            isPreviewingPattern ? stopPreview() : startPreview(strumPattern)
          }
          className="h-7 px-2 gap-1"
        >
          {isPreviewingPattern ? (
            <>
              <SquareIcon className="w-3 h-3" />
              Stop
            </>
          ) : (
            <>
              <PlayIcon className="w-3 h-3" />
              Preview
            </>
          )}
        </Button>
      </div>
      <div className="relative h-8 rounded border bg-muted/30 overflow-hidden">
        {isPreviewingPattern && (
          <div
            className="absolute top-0 left-0 h-full bg-green-500/20 transition-none"
            style={{ width: `${previewProgress * 100}%` }}
          />
        )}
        <div className="absolute top-0 left-0 right-0 h-full flex">
          {[0, 1, 2, 3].map((beat) => (
            <div
              key={beat}
              className="flex-1 border-r border-dashed border-muted-foreground/20 last:border-r-0"
            />
          ))}
        </div>
        {strumPattern.map((note, index) => (
          <div
            key={index}
            className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
              note.direction === "down" ? "bg-blue-500" : "bg-orange-500"
            }`}
            style={{ left: `calc(${note.position * 100}% - 4px)` }}
          />
        ))}
      </div>
    </div>
  )
}
