import { type PracticeMode } from "@/app/scale-trainer/page"
import { NOTE_NAMES, NoteName } from "@/lib/audio/utils"
import { SCALE_NAMES, ScaleType } from "@/lib/constants"
import { Mic, MicOff } from "lucide-react"
import { Button } from "../ui/button"

interface ScaleTrainerControlsProps {
  selectedScale: ScaleType | null
  setSelectedScale: (scale: ScaleType | null) => void
  selectedKey: NoteName | null
  setSelectedKey: (key: NoteName | null) => void
  showNotes: boolean
  setShowNotes: (showNotes: boolean) => void
  showDegree: boolean
  setShowDegree: (showDegree: boolean) => void
  isListening: boolean
  stopListening: () => void
  startListening: () => void
  startSession: (mode: PracticeMode) => void
}

export default function ScaleTrainerControls({
  selectedScale,
  setSelectedScale,
  selectedKey,
  setSelectedKey,
  showNotes,
  setShowNotes,
  showDegree,
  setShowDegree,
  isListening,
  stopListening,
  startListening,
  startSession,
}: ScaleTrainerControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <label className="text-muted-foreground text-sm font-medium">Scale</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SCALE_NAMES) as ScaleType[]).map((scale) => (
            <Button
              key={scale}
              variant={selectedScale === scale ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedScale(selectedScale === scale ? null : scale)}
            >
              {SCALE_NAMES[scale]}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-muted-foreground text-sm font-medium">Key</label>
        <div className="flex flex-wrap gap-2">
          {NOTE_NAMES.map((note) => (
            <Button
              key={note}
              variant={selectedKey === note ? "default" : "outline"}
              size="sm"
              className="w-12"
              onClick={() => setSelectedKey(selectedKey === note ? null : note)}
            >
              {note}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant={showNotes ? "default" : "outline"}
          size="sm"
          onClick={() => setShowNotes(!showNotes)}
        >
          {showNotes ? "Notes Visible" : "Notes Hidden"}
        </Button>

        <Button
          variant={showDegree ? "default" : "outline"}
          size="sm"
          onClick={() => setShowDegree(!showDegree)}
        >
          {showDegree ? "Show Degree" : "Show Notes"}
        </Button>

        <Button variant="outline" size="sm" onClick={isListening ? stopListening : startListening}>
          {isListening ? (
            <>
              <Mic className="mr-2 h-4 w-4" />
              Mic On
            </>
          ) : (
            <>
              <MicOff className="mr-2 h-4 w-4" />
              Mic Off
            </>
          )}
        </Button>
      </div>
      <div className="bg-card border-border rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-foreground text-lg font-semibold">
              {selectedScale
                ? selectedKey
                  ? `${selectedKey} ${SCALE_NAMES[selectedScale]}`
                  : "Select a key"
                : "Select a scale"}
            </p>
            <p className="text-muted-foreground text-sm">
              Practice random CAGED shapes with pitch detection
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="lg"
              disabled={!(selectedScale && selectedKey)}
              onClick={() => startSession("timed")}
            >
              Start Practice
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={!(selectedScale && selectedKey)}
              onClick={() => startSession("unlimited")}
            >
              Start Unlimited
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
