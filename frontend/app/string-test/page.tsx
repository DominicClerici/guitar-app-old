"use client"

import { useEffect, useState } from "react"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStringCalibration } from "@/hooks/useStringCalibration"
import { useStringDetection } from "@/hooks/useStringDetection"
import {
  deleteCalibration,
  getActiveCalibration,
  listCalibrations,
  clearActiveCalibration,
  setActiveCalibration,
} from "@/lib/audio/calibration-storage"
import type { CalibrationPhase } from "@/lib/audio/calibration-types"
import { STANDARD_TUNING_STRINGS } from "@/lib/audio/guitar-constants"

const PHASE_LABELS: Record<CalibrationPhase, string> = {
  open: "Open Strings",
  fret5: "Fret 5",
  fret12: "Fret 12",
}

const PHASE_NUMBERS: Record<CalibrationPhase, number> = {
  open: 1,
  fret5: 2,
  fret12: 3,
}

function getFretLabel(fret: number): string {
  if (fret === 0) return "Open String"
  return `Fret ${fret}`
}

export default function StringTestPage() {
  const [selectedCalibrationId, setSelectedCalibrationId] = useState<string | undefined>(undefined)
  const [calibrations, setCalibrations] = useState<{ id: string; name: string }[]>([])
  const [guitarName, setGuitarName] = useState("")
  const [showCalibration, setShowCalibration] = useState(false)

  const {
    status,
    error,
    pitch,
    clarity,
    sampleRate,
    stringNumber,
    stringName,
    fretNumber,
    stringConfidence,
    startListening,
    stopListening,
  } = useStringDetection({ calibrationId: selectedCalibrationId })

  const {
    status: calibrationStatus,
    currentStep,
    currentStringNumber,
    currentPhase,
    currentFret,
    progress,
    error: calibrationError,
    collectedSamples,
    startCalibration,
    cancelCalibration,
    skipString,
    skipPhase,
    calibrationData,
  } = useStringCalibration()

  useEffect(() => {
    const list = listCalibrations()
    setCalibrations(list)
    const active = getActiveCalibration()
    if (active) {
      setSelectedCalibrationId(active.id)
    }
  }, [])

  useEffect(() => {
    if (calibrationData) {
      const list = listCalibrations()
      setCalibrations(list)
      setSelectedCalibrationId(calibrationData.id)
      setGuitarName("")
    }
  }, [calibrationData])

  const handleCalibrationSelect = (value: string) => {
    if (value === "none") {
      clearActiveCalibration()
      setSelectedCalibrationId(undefined)
    } else {
      setActiveCalibration(value)
      setSelectedCalibrationId(value)
    }
  }

  const handleDeleteCalibration = (id: string) => {
    deleteCalibration(id)
    const list = listCalibrations()
    setCalibrations(list)
    if (selectedCalibrationId === id) {
      setSelectedCalibrationId(undefined)
    }
  }

  const handleStartCalibration = () => {
    if (!guitarName.trim()) return
    if (status === "recording") {
      stopListening()
    }
    startCalibration(guitarName.trim())
  }

  const getStringNameForNumber = (num: number) => {
    const profile = STANDARD_TUNING_STRINGS.find((s) => s.stringNumber === num)
    return profile ? `${profile.name} (${num})` : `String ${num}`
  }

  const isRecording = status === "recording"
  const isRequesting = status === "requesting"
  const isCalibrating = calibrationStatus === "calibrating"

  const markers: Marker[] = []
  if (stringNumber !== null && fretNumber !== null) {
    markers.push({
      stringIndex: stringNumber - 1,
      fretIndex: fretNumber,
      type: "played",
      label: stringName || "",
    })
  }

  const attackSamplesRequired = 7
  const sustainSamplesRequired = 7
  const totalSamplesRequired = attackSamplesRequired + sustainSamplesRequired

  const canSkipPhase = currentPhase !== "open"

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">String Detection Test</h1>
        <p className="text-muted-foreground">
          Test the string detection algorithm by playing notes on your guitar.
        </p>
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Guitar Calibration</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCalibration(!showCalibration)}
          >
            {showCalibration ? "Hide" : "Show"}
          </Button>
        </div>

        {showCalibration && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Select
                value={selectedCalibrationId ?? "none"}
                onValueChange={handleCalibrationSelect}
                disabled={isCalibrating}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select calibration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No calibration</SelectItem>
                  {calibrations.map((cal) => (
                    <SelectItem key={cal.id} value={cal.id}>
                      {cal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCalibrationId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteCalibration(selectedCalibrationId)}
                  disabled={isCalibrating}
                >
                  Delete
                </Button>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="mb-3 text-sm font-medium">New Calibration</h3>
              {!isCalibrating ? (
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="Guitar name (e.g., My Acoustic)"
                    value={guitarName}
                    onChange={(e) => setGuitarName(e.target.value)}
                    className="max-w-[250px]"
                  />
                  <Button
                    onClick={handleStartCalibration}
                    disabled={!guitarName.trim()}
                  >
                    Start Calibration
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      Calibrating: <span className="font-medium">{guitarName}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={cancelCalibration}>
                      Cancel
                    </Button>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-center text-lg font-semibold">
                      Phase {PHASE_NUMBERS[currentPhase]}/3: {PHASE_LABELS[currentPhase]}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Overall Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {currentStep.type === "listening" && (
                    <Card className="border-primary bg-primary/5 p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">
                            Play: {getStringNameForNumber(currentStep.stringNumber)} - {getFretLabel(currentStep.fret)}
                          </h4>
                          <div className="flex gap-2">
                            {canSkipPhase && (
                              <Button variant="outline" size="sm" onClick={skipPhase}>
                                Skip Phase
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={skipString}>
                              Skip String
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Play the string{currentStep.fret > 0 ? ` at fret ${currentStep.fret}` : ""} and let it ring for at least half a second.
                          Then mute and play again. Repeat until both bars are full.
                        </p>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Attack samples (0-100ms)</span>
                              <span>{currentStep.attackSamples} / {attackSamplesRequired}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-orange-500 transition-all"
                                style={{ width: `${(currentStep.attackSamples / attackSamplesRequired) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Sustain samples (300-500ms)</span>
                              <span>{currentStep.sustainSamples} / {sustainSamplesRequired}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${(currentStep.sustainSamples / sustainSamplesRequired) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {currentStep.type === "complete" && (
                    <Card className="border-green-500 bg-green-500/10 p-4">
                      <p className="text-sm text-green-700 dark:text-green-400">
                        {getStringNameForNumber(currentStep.stringNumber)} ({getFretLabel(currentStep.fret)}) calibrated! Moving to next...
                      </p>
                    </Card>
                  )}

                  {currentStep.type === "phase-complete" && (
                    <Card className="border-green-500 bg-green-500/10 p-4">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        Phase complete: {PHASE_LABELS[currentStep.phase]}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                        Moving to next phase...
                      </p>
                    </Card>
                  )}

                  {currentStep.type === "error" && (
                    <Card className="border-destructive bg-destructive/10 p-4">
                      <p className="text-sm text-destructive">{currentStep.message}</p>
                    </Card>
                  )}

                  <div className="space-y-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      Phase Progress - {PHASE_LABELS[currentPhase]}
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {[6, 5, 4, 3, 2, 1].map((stringNum) => {
                        const sampleKey = `${stringNum}-${currentFret}`
                        const totalSamples = collectedSamples.get(sampleKey) ?? 0
                        const isActive = currentStringNumber === stringNum
                        const isComplete = totalSamples >= totalSamplesRequired
                        return (
                          <div
                            key={stringNum}
                            className={`rounded border p-2 text-center text-xs ${
                              isActive
                                ? "border-primary bg-primary/10"
                                : isComplete
                                  ? "border-green-500 bg-green-500/10"
                                  : "border-muted"
                            }`}
                          >
                            <div className="font-medium">{stringNum}</div>
                            <div className="text-muted-foreground">{totalSamples}/{totalSamplesRequired}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {calibrationError && (
              <Card className="border-destructive bg-destructive/10 p-4">
                <p className="text-destructive">{calibrationError}</p>
              </Card>
            )}

            {calibrationStatus === "complete" && calibrationData && (
              <Card className="border-green-500 bg-green-500/10 p-4">
                <p className="text-green-700 dark:text-green-400">
                  Calibration complete! &quot;{calibrationData.name}&quot; has been saved and set as active.
                </p>
              </Card>
            )}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-4">
        <Button
          onClick={isRecording ? stopListening : startListening}
          disabled={isRequesting || isCalibrating}
          variant={isRecording ? "destructive" : "default"}
        >
          {isRequesting ? "Requesting..." : isRecording ? "Stop Listening" : "Start Listening"}
        </Button>
        <span className="text-sm text-muted-foreground">
          Status: <span className="font-medium">{status}</span>
          {selectedCalibrationId && (
            <span className="ml-2">
              (Using: {calibrations.find((c) => c.id === selectedCalibrationId)?.name ?? "Custom"})
            </span>
          )}
        </span>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-destructive">{error}</p>
        </Card>
      )}

      <Card className="overflow-hidden p-4">
        <Fretboard markers={markers} className="w-full" />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Detection Results</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">String:</div>
            <div className="font-mono">
              {stringNumber !== null ? `${stringNumber} (${stringName})` : "—"}
            </div>
            <div className="text-muted-foreground">Fret:</div>
            <div className="font-mono">{fretNumber !== null ? fretNumber : "—"}</div>
            <div className="text-muted-foreground">Confidence:</div>
            <div className="font-mono">
              {stringConfidence > 0 ? `${(stringConfidence * 100).toFixed(1)}%` : "—"}
            </div>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Audio Stats</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">Pitch:</div>
            <div className="font-mono">{pitch > 0 ? `${pitch.toFixed(2)} Hz` : "—"}</div>
            <div className="text-muted-foreground">Clarity:</div>
            <div className="font-mono">{clarity > 0 ? `${(clarity * 100).toFixed(1)}%` : "—"}</div>
            <div className="text-muted-foreground">Sample Rate:</div>
            <div className="font-mono">{sampleRate} Hz</div>
          </div>
        </Card>
      </div>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Debug Info</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Clarity Meter</div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(clarity * 100, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">String Confidence Meter</div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(stringConfidence * 100, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Pitch Range</div>
            <div className="font-mono text-xs">
              {pitch > 0 ? (
                <>
                  {pitch < 100 && "Low (Bass)"}
                  {pitch >= 100 && pitch < 250 && "Mid-Low"}
                  {pitch >= 250 && pitch < 500 && "Mid"}
                  {pitch >= 500 && pitch < 1000 && "Mid-High"}
                  {pitch >= 1000 && "High"}
                </>
              ) : (
                "—"
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
