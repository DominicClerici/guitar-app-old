"use client"

import { useEffect, useState } from "react"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import type { CalibrationPhase, CalibrationValidationResult, CalibrationWarning } from "@/lib/audio/calibration-types"
import { STANDARD_TUNING_STRINGS } from "@/lib/audio/guitar-constants"
import { Badge } from "@/components/ui/badge"

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

function QualityBadge({ quality }: { quality: "good" | "acceptable" | "poor" }) {
  const variants: Record<typeof quality, { className: string; label: string }> = {
    good: { className: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50", label: "Good" },
    acceptable: { className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50", label: "Acceptable" },
    poor: { className: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/50", label: "Poor" },
  }
  const { className, label } = variants[quality]
  return <Badge variant="outline" className={className}>{label}</Badge>
}

function ValidationWarnings({ validationResult }: { validationResult: CalibrationValidationResult }) {
  const getSeverityStyles = (severity: CalibrationWarning["severity"]) => {
    switch (severity) {
      case "error":
        return "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
      case "warning":
        return "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
      case "info":
        return "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400"
    }
  }

  const getSeverityLabel = (severity: CalibrationWarning["severity"]) => {
    switch (severity) {
      case "error":
        return "Error"
      case "warning":
        return "Warning"
      case "info":
        return "Info"
    }
  }

  return (
    <Card className="space-y-2 p-4">
      <h4 className="text-sm font-medium">Calibration Validation</h4>
      <div className="space-y-2">
        {validationResult.warnings.map((warning, index) => (
          <div
            key={index}
            className={`rounded-md border p-3 text-sm ${getSeverityStyles(warning.severity)}`}
          >
            <div className="flex items-start gap-2">
              <Badge variant="outline" className={getSeverityStyles(warning.severity)}>
                {getSeverityLabel(warning.severity)}
              </Badge>
              <span>{warning.message}</span>
            </div>
            {warning.affectedStrings && warning.affectedStrings.length > 0 && (
              <div className="mt-2 text-xs opacity-80">
                Affected strings: {warning.affectedStrings.join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
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
    secondBestString,
    secondBestConfidence,
    scoreDifference,
    allCandidateScores,
    measuredInharmonicity,
    spectralCentroid,
    expectedInharmonicity,
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
    validationResult,
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
  const plucksRequired = 5
  const samplesPerPluck = attackSamplesRequired + sustainSamplesRequired
  const totalSamplesRequired = samplesPerPluck * plucksRequired

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
                          <div>
                            <h4 className="font-medium">
                              Play: {getStringNameForNumber(currentStep.stringNumber)} - {getFretLabel(currentStep.fret)}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              Pluck {currentStep.currentPluck} of {currentStep.totalPlucks}
                            </p>
                          </div>
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
                          Then mute and play again. You need to do this {plucksRequired} times.
                        </p>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Pluck Progress</span>
                            <span>{currentStep.currentPluck} / {currentStep.totalPlucks}</span>
                          </div>
                          <div className="flex gap-1">
                            {Array.from({ length: plucksRequired }).map((_, i) => (
                              <div
                                key={i}
                                className={`h-2 flex-1 rounded-full transition-all ${
                                  i < currentStep.currentPluck - 1
                                    ? "bg-green-500"
                                    : i === currentStep.currentPluck - 1
                                      ? "bg-primary"
                                      : "bg-muted"
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2 rounded-md bg-muted/50 p-3">
                          <div className="text-xs font-medium text-muted-foreground">Current Pluck Samples</div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Attack (0-100ms)</span>
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
                              <span>Sustain (300-500ms)</span>
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

                  {currentStep.type === "pluck-complete" && (
                    <Card className="border-blue-500 bg-blue-500/10 p-4">
                      <p className="text-sm text-blue-700 dark:text-blue-400">
                        Pluck {currentStep.pluckNumber} of {currentStep.totalPlucks} complete! Mute the string and pluck again...
                      </p>
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
              <div className="space-y-3">
                <Card className="border-green-500 bg-green-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-green-700 dark:text-green-400">
                      Calibration complete! &quot;{calibrationData.name}&quot; has been saved and set as active.
                    </p>
                    {validationResult && (
                      <QualityBadge quality={validationResult.overallQuality} />
                    )}
                  </div>
                </Card>
                {validationResult && validationResult.warnings.length > 0 && (
                  <ValidationWarnings validationResult={validationResult} />
                )}
              </div>
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
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Confidence</span>
              <span className="font-mono">
                {stringConfidence > 0 ? `${(stringConfidence * 100).toFixed(0)}%` : "—"}
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all ${
                  stringConfidence >= 0.75
                    ? "bg-green-500"
                    : stringConfidence >= 0.5
                      ? "bg-yellow-500"
                      : stringConfidence >= 0.25
                        ? "bg-orange-500"
                        : "bg-red-500"
                }`}
                style={{ width: `${Math.min(stringConfidence * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uncertain</span>
              <span>Confident</span>
            </div>
          </div>

          {scoreDifference < 0.15 && secondBestString !== null && stringNumber !== null && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              Also possible: String {secondBestString} ({(secondBestConfidence * 100).toFixed(0)}%)
            </div>
          )}
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

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="detailed-view" className="border-none">
            <AccordionTrigger className="text-sm py-2 hover:no-underline">
              Detailed Analysis
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Candidate Scores</div>
                  <div className="space-y-1">
                    {allCandidateScores.length > 0 ? (
                      allCandidateScores.map((candidate, index) => {
                        const stringProfile = STANDARD_TUNING_STRINGS.find(
                          (s) => s.stringNumber === candidate.stringNumber
                        )
                        const stringLabel = stringProfile
                          ? `${stringProfile.name} (S${candidate.stringNumber})`
                          : `String ${candidate.stringNumber}`
                        const maxScore = allCandidateScores[0]?.totalScore ?? 1
                        const normalizedScore = maxScore > 0 ? candidate.totalScore / maxScore : 0
                        return (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>
                                {stringLabel} F{candidate.fretNumber}
                              </span>
                              <span className="font-mono">
                                {(candidate.totalScore * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full transition-all ${
                                  index === 0 ? "bg-primary" : "bg-muted-foreground/40"
                                }`}
                                style={{ width: `${normalizedScore * 100}%` }}
                              />
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground">No candidates detected</div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div className="font-medium text-muted-foreground">Inharmonicity</div>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-muted-foreground">Measured:</span>
                      <span className="font-mono">
                        {measuredInharmonicity > 0
                          ? measuredInharmonicity.toExponential(2)
                          : "—"}
                      </span>
                      <span className="text-muted-foreground">Expected:</span>
                      <span className="font-mono">
                        {expectedInharmonicity > 0
                          ? expectedInharmonicity.toExponential(2)
                          : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium text-muted-foreground">Spectral</div>
                    <div className="grid grid-cols-2 gap-1">
                      <span className="text-muted-foreground">Centroid:</span>
                      <span className="font-mono">
                        {spectralCentroid > 0 ? `${spectralCentroid.toFixed(0)} Hz` : "—"}
                      </span>
                      <span className="text-muted-foreground">Score Gap:</span>
                      <span className="font-mono">
                        {scoreDifference > 0 ? scoreDifference.toFixed(3) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </div>
  )
}
