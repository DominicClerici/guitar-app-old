"use client"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useInharmonicityDetection } from "@/hooks/useInharmonicityDetection"
import { useSpectralStringDetection } from "@/hooks/useSpectralStringDetection"
import { getClosestNoteName } from "@/lib/audio/utils"
import { STANDARD_TUNING_STRINGS } from "@/lib/audio/guitar-constants"
import { Fretboard, type Marker } from "@/components/fretboard/fretboard"

type DetectionMethod = "inharmonicity" | "spectral"

export default function StringDetectionPage() {
  const [method, setMethod] = useState<DetectionMethod>("inharmonicity")
  const [kValue, setKValue] = useState(5)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const inharmonicity = useInharmonicityDetection()
  const spectral = useSpectralStringDetection({ k: kValue })

  const isRecording =
    method === "inharmonicity"
      ? inharmonicity.status === "recording"
      : spectral.status === "recording"

  const currentStatus = method === "inharmonicity" ? inharmonicity.status : spectral.status
  const currentError = method === "inharmonicity" ? inharmonicity.error : spectral.error
  const currentSampleRate =
    method === "inharmonicity" ? inharmonicity.sampleRate : spectral.sampleRate

  const handleToggleListening = useCallback(() => {
    if (method === "inharmonicity") {
      if (isRecording) {
        inharmonicity.stopListening()
      } else {
        inharmonicity.startListening()
      }
    } else {
      if (isRecording) {
        spectral.stopListening()
      } else {
        spectral.startListening()
      }
    }
  }, [method, isRecording, inharmonicity, spectral])

  const handleMethodChange = useCallback(
    (newMethod: DetectionMethod) => {
      if (isRecording) {
        if (method === "inharmonicity") {
          inharmonicity.stopListening()
        } else {
          spectral.stopListening()
        }
      }
      setMethod(newMethod)
    },
    [isRecording, method, inharmonicity, spectral]
  )

  const handleKChange = useCallback(
    (value: number[]) => {
      const newK = value[0]
      setKValue(newK)
      spectral.setK(newK)
    },
    [spectral]
  )

  const handleAddTrainingSample = useCallback(
    (stringNumber: number) => {
      spectral.addTrainingSample(stringNumber)
    },
    [spectral]
  )

  const handleCrossValidate = useCallback(() => {
    const result = spectral.crossValidate()
    if (result) {
      console.log("Cross-validation result:", result)
    }
  }, [spectral])

  const detection =
    method === "inharmonicity" ? inharmonicity.data?.detection : spectral.data?.detection
  const pitch = method === "inharmonicity" ? inharmonicity.data?.pitch : spectral.data?.pitch
  const clarity =
    method === "inharmonicity" ? inharmonicity.data?.clarity : spectral.data?.clarity
  const candidates =
    method === "inharmonicity" ? inharmonicity.data?.candidates : spectral.data?.candidates

  const fretboardMarkers: Marker[] = useMemo(() => {
    if (!detection || detection.confidence < 0.3) return []

    const stringIndex = 6 - detection.stringNumber
    return [
      {
        stringIndex,
        fretIndex: detection.fretNumber,
        type: "played",
        label: detection.stringName,
      },
    ]
  }, [detection])

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-3xl font-bold">String Detection Test</h1>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Tabs value={method} onValueChange={(v) => handleMethodChange(v as DetectionMethod)}>
          <TabsList>
            <TabsTrigger value="inharmonicity">Inharmonicity</TabsTrigger>
            <TabsTrigger value="spectral">Spectral/ML</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          onClick={handleToggleListening}
          variant={isRecording ? "destructive" : "default"}
          disabled={currentStatus === "requesting"}
        >
          {currentStatus === "requesting"
            ? "Requesting..."
            : isRecording
              ? "Stop Listening"
              : "Start Listening"}
        </Button>

        <Badge variant="outline" className="px-3 py-1 text-sm">
          Status: {currentStatus}
        </Badge>
        <Badge variant="secondary" className="px-3 py-1 text-sm">
          Sample Rate: {currentSampleRate} Hz
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm">Advanced</span>
          <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
        </div>
      </div>

      {currentError && (
        <Card className="border-destructive mb-6">
          <CardContent className="pt-4">
            <p className="text-destructive">{currentError}</p>
          </CardContent>
        </Card>
      )}

      {method === "spectral" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>ML Model Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">K-Neighbors</span>
                  <span className="text-muted-foreground text-sm">{kValue}</span>
                </div>
                <Slider
                  value={[kValue]}
                  onValueChange={handleKChange}
                  min={1}
                  max={15}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">Training Stats</span>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    Total: {spectral.trainingStats.totalSamples} samples
                  </Badge>
                  {spectral.trainingStats.accuracy !== null && (
                    <Badge variant="secondary">
                      Accuracy: {(spectral.trainingStats.accuracy * 100).toFixed(1)}%
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {STANDARD_TUNING_STRINGS.map((s) => (
                    <Badge
                      key={s.stringNumber}
                      variant={
                        (spectral.trainingStats.samplesPerString.get(s.stringNumber) ?? 0) > 0
                          ? "default"
                          : "outline"
                      }
                      className="text-xs"
                    >
                      {s.name}: {spectral.trainingStats.samplesPerString.get(s.stringNumber) ?? 0}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium">Add Sample:</span>
              {STANDARD_TUNING_STRINGS.map((s) => (
                <Button
                  key={s.stringNumber}
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddTrainingSample(s.stringNumber)}
                  disabled={!spectral.data}
                >
                  {s.name}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => spectral.trainModel()}>
                Train Model
              </Button>
              <Button size="sm" variant="outline" onClick={() => spectral.saveModel()}>
                Save Model
              </Button>
              <Button size="sm" variant="outline" onClick={() => spectral.loadModel()}>
                Load Model
              </Button>
              <Button size="sm" variant="outline" onClick={handleCrossValidate}>
                Cross-Validate
              </Button>
              <Button size="sm" variant="destructive" onClick={() => spectral.clearModel()}>
                Clear Model
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(method === "inharmonicity" ? inharmonicity.data : spectral.data) ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fretboard</CardTitle>
            </CardHeader>
            <CardContent>
              <Fretboard markers={fretboardMarkers} className="w-full" />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>String Detection</CardTitle>
            </CardHeader>
            <CardContent>
              {detection ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-primary text-6xl font-bold">{detection.stringNumber}</div>
                    <div className="text-muted-foreground text-2xl">{detection.stringName}</div>
                    <div className="text-lg">Fret {detection.fretNumber}</div>
                  </div>
                  <div className="flex justify-center">
                    <Badge
                      variant={
                        detection.confidence > 0.7
                          ? "default"
                          : detection.confidence > 0.5
                            ? "secondary"
                            : "outline"
                      }
                    >
                      Confidence: {(detection.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>

                  {method === "spectral" && spectral.data?.classificationResult && (
                    <div className="space-y-2 border-t pt-4">
                      <span className="text-sm font-medium">String Probabilities</span>
                      <div className="space-y-1">
                        {[...spectral.data.classificationResult.probabilities.entries()]
                          .sort((a, b) => b[1] - a[1])
                          .map(([stringNum, prob]) => {
                            const profile = STANDARD_TUNING_STRINGS.find(
                              (s) => s.stringNumber === stringNum
                            )
                            return (
                              <div key={stringNum} className="flex items-center gap-2">
                                <span className="w-8 text-sm">{profile?.name ?? stringNum}</span>
                                <div className="bg-muted h-2 flex-1 rounded">
                                  <div
                                    className="bg-primary h-full rounded"
                                    style={{ width: `${prob * 100}%` }}
                                  />
                                </div>
                                <span className="text-muted-foreground w-12 text-right text-xs">
                                  {(prob * 100).toFixed(0)}%
                                </span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center">No string detected</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pitch Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frequency</span>
                <span className="font-mono">{pitch?.toFixed(2)} Hz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Note</span>
                <span className="font-mono">{pitch ? getClosestNoteName(pitch) ?? "-" : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Clarity</span>
                <span className="font-mono">{clarity ? (clarity * 100).toFixed(1) : 0}%</span>
              </div>
            </CardContent>
          </Card>

          {method === "inharmonicity" && inharmonicity.data && (
            <Card>
              <CardHeader>
                <CardTitle>Inharmonicity Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">B Coefficient</span>
                  <span className="font-mono">
                    {inharmonicity.data.estimatedB.toExponential(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">B Confidence</span>
                  <span className="font-mono">
                    {(inharmonicity.data.bConfidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spectral Centroid</span>
                  <span className="font-mono">
                    {inharmonicity.data.spectralCentroid.toFixed(0)} Hz
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Partials Detected</span>
                  <span className="font-mono">{inharmonicity.data.partials.length}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {method === "spectral" && spectral.data && (
            <Card>
              <CardHeader>
                <CardTitle>Spectral Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spectral Centroid</span>
                  <span className="font-mono">
                    {spectral.data.features.spectralCentroid.toFixed(0)} Hz
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spectral Rolloff</span>
                  <span className="font-mono">
                    {spectral.data.features.spectralRolloff.toFixed(0)} Hz
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spectral Spread</span>
                  <span className="font-mono">
                    {spectral.data.features.spectralSpread.toFixed(0)} Hz
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spectral Flatness</span>
                  <span className="font-mono">
                    {spectral.data.features.spectralFlatness.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zero Crossing Rate</span>
                  <span className="font-mono">
                    {spectral.data.features.zeroCrossingRate.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">H2/H1 Ratio</span>
                  <span className="font-mono">
                    {spectral.data.features.harmonicRatios.h2h1.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">H3/H1 Ratio</span>
                  <span className="font-mono">
                    {spectral.data.features.harmonicRatios.h3h1.toFixed(3)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Candidate Positions</CardTitle>
            </CardHeader>
            <CardContent>
              {candidates && candidates.length > 0 ? (
                <div className="space-y-2">
                  {candidates.map((c) => (
                    <div
                      key={`${c.stringNumber}-${c.fretNumber}`}
                      className={`flex justify-between rounded p-2 ${
                        detection?.stringNumber === c.stringNumber &&
                        detection?.fretNumber === c.fretNumber
                          ? "border-primary bg-primary/10 border"
                          : "bg-muted/50"
                      }`}
                    >
                      <span>String {c.stringNumber}</span>
                      <span>Fret {c.fretNumber}</span>
                      <span className="text-muted-foreground font-mono text-sm">
                        {c.expectedFreq.toFixed(1)} Hz
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center">No candidates</p>
              )}
            </CardContent>
          </Card>

          {showAdvanced && method === "spectral" && spectral.data && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>MFCC Coefficients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {spectral.data.features.mfccs.map((mfcc, i) => (
                    <Badge key={i} variant="outline" className="font-mono text-xs">
                      MFCC{i + 1}: {mfcc.toFixed(2)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {showAdvanced && method === "inharmonicity" && inharmonicity.data && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Detected Partials</CardTitle>
              </CardHeader>
              <CardContent>
                {inharmonicity.data.partials.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2 text-left">Harmonic</th>
                          <th className="p-2 text-left">Expected</th>
                          <th className="p-2 text-left">Actual</th>
                          <th className="p-2 text-left">Deviation</th>
                          <th className="p-2 text-left">B Estimate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inharmonicity.data.partials.map((p) => {
                          const deviationCents =
                            1200 * Math.log2(p.actualFreq / p.expectedFreq)
                          return (
                            <tr key={p.harmonicNumber} className="border-b">
                              <td className="p-2 font-mono">{p.harmonicNumber}</td>
                              <td className="p-2 font-mono">{p.expectedFreq.toFixed(1)} Hz</td>
                              <td className="p-2 font-mono">{p.actualFreq.toFixed(1)} Hz</td>
                              <td className="p-2 font-mono">
                                {deviationCents >= 0 ? "+" : ""}
                                {deviationCents.toFixed(1)} cents
                              </td>
                              <td className="p-2 font-mono">{p.bEstimate.toExponential(3)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center">No partials detected</p>
                )}
              </CardContent>
            </Card>
          )}

          {showAdvanced && method === "spectral" && spectral.data?.classificationResult && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Nearest Neighbors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {spectral.data.classificationResult.nearestNeighbors.map((neighbor, i) => {
                    const profile = STANDARD_TUNING_STRINGS.find(
                      (s) => s.stringNumber === neighbor.label
                    )
                    return (
                      <Badge
                        key={i}
                        variant={
                          neighbor.label === spectral.data?.detection?.stringNumber
                            ? "default"
                            : "outline"
                        }
                      >
                        {profile?.name ?? `String ${neighbor.label}`} (d=
                        {neighbor.distance.toFixed(2)})
                      </Badge>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">
              {isRecording ? "Play a note on your guitar..." : "Click 'Start Listening' to begin"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
