"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  Mic,
  MicOff,
  Download,
  Upload,
  Trash2,
  Plus,
  Activity,
  Waves,
  CircleDot,
} from "lucide-react"
import {
  useSpectralStringDetection,
  type DetectionMethod,
} from "@/hooks/useSpectralStringDetection"
import type { KNNModel } from "@/lib/audio/knn-classifier"

const STRING_NAMES: Record<number, string> = {
  1: "E4",
  2: "B3",
  3: "G3",
  4: "D3",
  5: "A2",
  6: "E2",
}

const STRING_LABELS: Record<number, string> = {
  1: "High E",
  2: "B",
  3: "G",
  4: "D",
  5: "A",
  6: "Low E",
}

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const percentage = Math.round(value * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-150"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-10 text-xs text-right text-muted-foreground">
        {percentage}%
      </span>
    </div>
  )
}

function FeatureValue({
  label,
  value,
  unit,
}: {
  label: string
  value: number | undefined
  unit?: string
}) {
  const formatted =
    value !== undefined ? (value > 1000 ? value.toFixed(0) : value.toFixed(3)) : "-"
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono">
        {formatted}
        {unit && value !== undefined && (
          <span className="text-muted-foreground ml-1">{unit}</span>
        )}
      </span>
    </div>
  )
}

export default function StringDetectionPage() {
  const [minConfidence, setMinConfidence] = useState(0.3)
  const [fundamentalFreqInput, setFundamentalFreqInput] = useState("")
  const [samplesPerString, setSamplesPerString] = useState<Record<number, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    status,
    error,
    sampleRate,
    currentResult,
    currentFeatures,
    detectionMethod,
    setDetectionMethod,
    setFundamentalFrequency,
    startListening,
    stopListening,
    classifier,
    captureTrainingSample,
  } = useSpectralStringDetection()

  const handleToggleListening = () => {
    if (status === "listening") {
      stopListening()
    } else if (status === "idle" || status === "error") {
      startListening()
    }
  }

  const handleMethodChange = (checked: boolean) => {
    setDetectionMethod(checked ? "knn" : "rule-based")
  }

  const handleFundamentalFreqChange = (value: string) => {
    setFundamentalFreqInput(value)
    const freq = parseFloat(value)
    if (!isNaN(freq) && freq > 0) {
      setFundamentalFrequency(freq)
    } else {
      setFundamentalFrequency(undefined)
    }
  }

  const handleCaptureSample = (stringNumber: number) => {
    const sample = captureTrainingSample(stringNumber)
    if (sample) {
      classifier.addSample(sample)
      setSamplesPerString({ ...classifier.samplesPerString })
    }
  }

  const handleClearSamples = (stringNumber: number) => {
    classifier.removeSamplesForString(stringNumber)
    setSamplesPerString({ ...classifier.samplesPerString })
  }

  const handleExportModel = () => {
    const model = classifier.exportModel()
    const blob = new Blob([JSON.stringify(model, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "string-detection-model.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportModel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const model = JSON.parse(e.target?.result as string) as KNNModel
        classifier.importModel(model)
        setSamplesPerString({ ...classifier.samplesPerString })
      } catch (err) {
        console.error("Failed to import model:", err)
      }
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  const predictedString = currentResult?.predictedString
  const showPrediction =
    predictedString !== null &&
    predictedString !== undefined &&
    currentResult &&
    currentResult.confidence >= minConfidence

  const statusBadgeVariant =
    status === "listening"
      ? "default"
      : status === "error"
        ? "destructive"
        : "secondary"

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">String Detection Utility</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Controls Section */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Controls
          </h2>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleToggleListening}
                disabled={status === "requesting"}
                variant={status === "listening" ? "destructive" : "default"}
                size="lg"
                className="flex-1"
              >
                {status === "listening" ? (
                  <>
                    <MicOff className="mr-2 h-5 w-5" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-5 w-5" />
                    Start Listening
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Detection Method</label>
                <p className="text-xs text-muted-foreground">
                  {detectionMethod === "knn" ? "KNN Classifier" : "Rule-based"}
                </p>
              </div>
              <Switch
                checked={detectionMethod === "knn"}
                onCheckedChange={handleMethodChange}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Minimum Confidence: {Math.round(minConfidence * 100)}%
              </label>
              <Slider
                value={[minConfidence]}
                onValueChange={([value]) => setMinConfidence(value)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Fundamental Frequency (Hz)
              </label>
              <Input
                type="number"
                placeholder="e.g., 329.63 for E4"
                value={fundamentalFreqInput}
                onChange={(e) => handleFundamentalFreqChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional: Enter a frequency to constrain candidate strings
              </p>
            </div>
          </div>
        </Card>

        {/* Prediction Display */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CircleDot className="h-5 w-5" />
            Prediction
          </h2>

          <div className="text-center mb-6">
            {showPrediction ? (
              <>
                <div className="text-8xl font-bold text-primary mb-2">
                  {predictedString}
                </div>
                <div className="text-2xl font-semibold text-muted-foreground">
                  {STRING_NAMES[predictedString!]} ({STRING_LABELS[predictedString!]})
                </div>
                <div className="mt-4">
                  <div className="text-sm text-muted-foreground mb-1">Confidence</div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden max-w-xs mx-auto">
                    <div
                      className="h-full bg-primary transition-all duration-150"
                      style={{ width: `${Math.round(currentResult.confidence * 100)}%` }}
                    />
                  </div>
                  <div className="text-lg font-mono mt-1">
                    {Math.round(currentResult.confidence * 100)}%
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-muted-foreground">
                {status === "listening"
                  ? "Waiting for detection..."
                  : "Start listening to detect strings"}
              </div>
            )}
          </div>

          {currentResult && (
            <div className="space-y-1">
              <div className="text-sm font-medium mb-2">All String Confidences</div>
              {[1, 2, 3, 4, 5, 6].map((stringNum) => (
                <ConfidenceBar
                  key={stringNum}
                  label={`${stringNum}`}
                  value={currentResult.allConfidences[stringNum] ?? 0}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Status Display */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Detection Status</span>
              <Badge variant={statusBadgeVariant}>{status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sample Rate</span>
              <span className="text-sm font-mono">{sampleRate} Hz</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Method</span>
              <Badge variant="outline">{detectionMethod}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">KNN Samples</span>
              <span className="text-sm font-mono">{classifier.sampleCount}</span>
            </div>
            {currentResult?.candidateStrings && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Candidates</span>
                <div className="flex gap-1">
                  {currentResult.candidateStrings.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <span className="text-sm text-destructive">{error}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Feature Visualization */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Waves className="h-5 w-5" />
            Spectral Features
          </h2>

          <Tabs defaultValue="spectral" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="spectral">Spectral</TabsTrigger>
              <TabsTrigger value="mfcc">MFCC</TabsTrigger>
              <TabsTrigger value="harmonic">Harmonic</TabsTrigger>
            </TabsList>

            <TabsContent value="spectral" className="mt-4">
              <div className="space-y-1">
                <FeatureValue
                  label="Spectral Centroid"
                  value={currentFeatures?.centroid}
                  unit="Hz"
                />
                <FeatureValue
                  label="Spectral Rolloff"
                  value={currentFeatures?.rolloff}
                  unit="Hz"
                />
                <FeatureValue
                  label="Spectral Spread"
                  value={currentFeatures?.spread}
                  unit="Hz"
                />
                <FeatureValue
                  label="Spectral Flatness"
                  value={currentFeatures?.flatness}
                />
                <FeatureValue
                  label="Spectral Flux"
                  value={currentFeatures?.flux}
                />
                <FeatureValue
                  label="Zero Crossing Rate"
                  value={currentFeatures?.zcr}
                />
              </div>
            </TabsContent>

            <TabsContent value="mfcc" className="mt-4">
              <div className="space-y-1">
                {currentFeatures?.mfccs ? (
                  currentFeatures.mfccs.map((value, idx) => (
                    <FeatureValue key={idx} label={`MFCC ${idx + 1}`} value={value} />
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    No MFCC data available
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="harmonic" className="mt-4">
              <div className="space-y-1">
                <FeatureValue
                  label="H2/H1 Ratio"
                  value={currentFeatures?.harmonicRatios.h2h1}
                />
                <FeatureValue
                  label="H3/H1 Ratio"
                  value={currentFeatures?.harmonicRatios.h3h1}
                />
                <FeatureValue
                  label="Even/Odd Ratio"
                  value={currentFeatures?.harmonicRatios.evenOdd}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Note: Harmonic ratios require a fundamental frequency to be set for
                accurate measurement.
              </p>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Training Section */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">KNN Training</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            {[1, 2, 3, 4, 5, 6].map((stringNum) => (
              <div
                key={stringNum}
                className="border rounded-lg p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      String {stringNum} - {STRING_NAMES[stringNum]}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {STRING_LABELS[stringNum]}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {samplesPerString[stringNum] || 0} samples
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleCaptureSample(stringNum)}
                    disabled={status !== "listening"}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Capture
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleClearSamples(stringNum)}
                    disabled={(samplesPerString[stringNum] || 0) === 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleExportModel}>
              <Download className="h-4 w-4 mr-2" />
              Export Model
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Model
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportModel}
              className="hidden"
            />
            <div className="flex-1" />
            <div className="text-sm text-muted-foreground self-center">
              Total samples: {classifier.sampleCount}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
