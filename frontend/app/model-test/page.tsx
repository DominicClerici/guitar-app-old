"use client"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStringClassifier, type PredictionResult } from "@/hooks/useStringClassifier"
import { AlertCircle, Bug, CheckCircle2, Copy, Download, Loader2, Mic, MicOff } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"

const STRING_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-blue-500",
  "bg-purple-500",
]

const STRING_NAMES = ["E2 (Low)", "A2", "D3", "G3", "B3", "E4 (High)"]

const PRODUCTION_MODE = true

function createWavFile(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const bufferSize = 44 + dataSize

  const buffer = new ArrayBuffer(bufferSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, bufferSize - 8, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, "data")
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset, intSample, true)
    offset += 2
  }

  return buffer
}

const FEATURE_NAMES = [
  "harmonic_ratio_1",
  "harmonic_ratio_2",
  "harmonic_ratio_3",
  "harmonic_ratio_4",
  "harmonic_ratio_5",
  "harmonic_ratio_6",
  "harmonic_ratio_7",
  "harmonic_ratio_8",
  "harmonic_ratio_9",
  "harmonic_ratio_10",
  "harmonic_ratio_11",
  "harmonic_ratio_12",
  "spectral_centroid",
  "spectral_rolloff",
  "inharmonicity",
  "rms_energy",
  "energy_slope",
  "log_frequency",
  "semitones_from_e2",
  "octave_number",
  "mfcc_0",
  "mfcc_1",
  "mfcc_2",
  "mfcc_3",
  "mfcc_4",
  "mfcc_5",
  "mfcc_6",
  "mfcc_7",
  "mfcc_8",
  "mfcc_9",
  "mfcc_10",
  "mfcc_11",
  "mfcc_12",
]

export default function ModelTestPage() {
  const [history, setHistory] = useState<PredictionResult[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [capturedAudio, setCapturedAudio] = useState<{
    samples: Float32Array
    sampleRate: number
  } | null>(null)
  const [expectedString, setExpectedString] = useState<number>(1)
  const [expectedFret, setExpectedFret] = useState<number>(0)
  const audioBufferRef = useRef<Float32Array[]>([])

  const handlePrediction = useCallback((result: PredictionResult) => {
    setHistory((prev) => [result, ...prev].slice(0, 20))
  }, [])

  const {
    status,
    error,
    prediction,
    stablePrediction,
    startListening,
    stopListening,
    loadModel,
    isModelLoaded,
    captureAudioSample,
    scaler,
  } = useStringClassifier({
    onPrediction: handlePrediction,
    minConfidence: 0.25,
    debug: true,
    productionMode: PRODUCTION_MODE,
  })

  const fretboardMarkers = useMemo((): Marker[] => {
    if (!PRODUCTION_MODE || !stablePrediction) return []
    return [
      {
        stringIndex: stablePrediction.stringIndex,
        fretIndex: stablePrediction.fret,
        type: "played",
        label: stablePrediction.stringLabel,
      },
    ]
  }, [stablePrediction])

  const isRecording = status === "recording"
  const isLoading = status === "loading"

  const handleCaptureAudio = useCallback(() => {
    const sample = captureAudioSample()
    if (sample) {
      setCapturedAudio(sample)
      audioBufferRef.current.push(sample.samples)
    }
  }, [captureAudioSample])

  const handleDownloadAudio = useCallback(() => {
    if (!capturedAudio) return

    const { samples, sampleRate } = capturedAudio
    const wavBuffer = createWavFile(samples, sampleRate)
    const blob = new Blob([wavBuffer], { type: "audio/wav" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `capture_${Date.now()}.wav`
    a.click()
    URL.revokeObjectURL(url)
  }, [capturedAudio])

  const handleCopyFeatures = useCallback(() => {
    if (!prediction?.debug) return

    const data = {
      raw: prediction.debug.rawFeatureVector.reduce(
        (acc, val, idx) => {
          acc[FEATURE_NAMES[idx]] = val
          return acc
        },
        {} as Record<string, number>,
      ),
      normalized: prediction.debug.normalizedFeatureVector.reduce(
        (acc, val, idx) => {
          acc[FEATURE_NAMES[idx]] = val
          return acc
        },
        {} as Record<string, number>,
      ),
      sampleRate: prediction.debug.sampleRate,
      sampleCount: prediction.debug.sampleCount,
      prediction: {
        stringIndex: prediction.stringIndex,
        stringLabel: prediction.stringLabel,
        confidence: prediction.confidence,
        probabilities: prediction.allProbabilities,
      },
    }
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
  }, [prediction])

  const handleDownloadFeaturesJson = useCallback(() => {
    if (!prediction?.debug) return

    const data = {
      timestamp: new Date().toISOString(),
      expected: {
        string: expectedString,
        fret: expectedFret,
        stringLabel: STRING_NAMES[expectedString],
      },
      audio: {
        sampleRate: prediction.debug.sampleRate,
        sampleCount: prediction.debug.sampleCount,
        samples: Array.from(prediction.debug.audioSamples),
      },
      features: {
        raw: prediction.debug.rawFeatureVector,
        normalized: prediction.debug.normalizedFeatureVector,
        names: FEATURE_NAMES,
        fundamental: prediction.features.fundamental,
      },
      prediction: {
        stringIndex: prediction.stringIndex,
        stringLabel: prediction.stringLabel,
        confidence: prediction.confidence,
        probabilities: prediction.allProbabilities,
      },
      scaler: scaler ? { mean: scaler.mean, scale: scaler.scale } : null,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `debug_s${expectedString}_f${expectedFret}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [prediction, scaler, expectedString, expectedFret])

  return (
    <div className="bg-background min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">String Classifier Test</h1>
          <p className="text-muted-foreground mt-2">
            Real-time guitar string detection using neural network
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Model Status
              {isModelLoaded ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
            </CardTitle>
            <CardDescription>
              {isModelLoaded
                ? "Model loaded and ready for inference"
                : "Load the ONNX model to start"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {!isModelLoaded && (
                <Button onClick={loadModel} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Load Model
                </Button>
              )}
              <Button
                onClick={isRecording ? stopListening : startListening}
                variant={isRecording ? "destructive" : "default"}
                disabled={isLoading}
              >
                {isRecording ? (
                  <>
                    <MicOff className="mr-2 h-4 w-4" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4" />
                    Start Listening
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowDebug((v) => !v)}>
                <Bug className="mr-2 h-4 w-4" />
                {showDebug ? "Hide Debug" : "Show Debug"}
              </Button>
            </div>
            {error && (
              <div className="bg-destructive/10 text-destructive mt-4 rounded-md p-3">{error}</div>
            )}
          </CardContent>
        </Card>

        {PRODUCTION_MODE && (
          <Card>
            <CardHeader>
              <CardTitle>Live Fretboard</CardTitle>
              <CardDescription>
                {stablePrediction
                  ? `${stablePrediction.stringLabel} string, fret ${stablePrediction.fret} (${stablePrediction.fundamental.toFixed(1)} Hz)${stablePrediction.isLocked ? " - Locked" : " - Detecting..."}`
                  : "Play a note to see it on the fretboard"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Fretboard markers={fretboardMarkers} className="w-full" />

              <div className="mt-4 flex h-8 items-center justify-center gap-4">
                {stablePrediction && (
                  <>
                    <Badge
                      variant={stablePrediction.isLocked ? "default" : "secondary"}
                      className="text-sm"
                    >
                      {stablePrediction.isLocked ? "Locked" : "Accumulating..."}
                    </Badge>
                    <span className="text-muted-foreground text-sm">
                      Confidence: {(stablePrediction.confidence * 100).toFixed(1)}%
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {showDebug && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Debug Panel
              </CardTitle>
              <CardDescription>
                Capture audio and features for comparison with Python
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">What note are you playing?</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">String:</span>
                    <Select
                      value={expectedString.toString()}
                      onValueChange={(v) => setExpectedString(parseInt(v))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STRING_NAMES.map((name, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            {idx}: {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Fret:</span>
                    <Select
                      value={expectedFret.toString()}
                      onValueChange={(v) => setExpectedFret(parseInt(v))}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 13 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i === 0 ? "Open" : `Fret ${i}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Select what you&apos;re playing so the comparison script can load the matching
                  training sample.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleCaptureAudio} disabled={!isRecording}>
                  Capture Current Audio
                </Button>
                <Button variant="outline" onClick={handleDownloadAudio} disabled={!capturedAudio}>
                  <Download className="mr-2 h-4 w-4" />
                  Download WAV
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCopyFeatures}
                  disabled={!prediction?.debug}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Features JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadFeaturesJson}
                  disabled={!prediction?.debug}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Full Debug
                </Button>
              </div>

              {capturedAudio && (
                <div className="bg-muted rounded-md p-3">
                  <p className="text-sm font-medium">Captured Audio</p>
                  <p className="text-muted-foreground text-xs">
                    {capturedAudio.samples.length} samples @ {capturedAudio.sampleRate} Hz (
                    {((capturedAudio.samples.length / capturedAudio.sampleRate) * 1000).toFixed(0)}{" "}
                    ms)
                  </p>
                </div>
              )}

              {scaler && (
                <div className="bg-muted rounded-md p-3">
                  <p className="text-sm font-medium">Scaler Info</p>
                  <p className="text-muted-foreground text-xs">
                    {scaler.mean.length} features loaded
                  </p>
                </div>
              )}

              {prediction?.debug && (
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium">
                      Raw Feature Vector ({prediction.debug.rawFeatureVector.length} values)
                    </p>
                    <div className="bg-muted max-h-48 overflow-auto rounded-md p-2">
                      <table className="w-full font-mono text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="p-1 text-left">Feature</th>
                            <th className="p-1 text-right">Raw</th>
                            <th className="p-1 text-right">Normalized</th>
                            {scaler && <th className="p-1 text-right">Mean</th>}
                            {scaler && <th className="p-1 text-right">Scale</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {prediction.debug.rawFeatureVector.map((val, idx) => (
                            <tr key={idx} className="border-muted-foreground/10 border-b">
                              <td className="text-muted-foreground p-1">{FEATURE_NAMES[idx]}</td>
                              <td className="p-1 text-right">{val.toFixed(4)}</td>
                              <td className="p-1 text-right">
                                {prediction.debug!.normalizedFeatureVector[idx].toFixed(4)}
                              </td>
                              {scaler && (
                                <td className="text-muted-foreground p-1 text-right">
                                  {scaler.mean[idx]?.toFixed(4)}
                                </td>
                              )}
                              {scaler && (
                                <td className="text-muted-foreground p-1 text-right">
                                  {scaler.scale[idx]?.toFixed(4)}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Current Prediction</CardTitle>
            <CardDescription>
              {isRecording ? "Listening for guitar notes..." : "Start listening to see predictions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {prediction ? (
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-4">
                  <div
                    className={`flex h-24 w-24 items-center justify-center rounded-full ${STRING_COLORS[prediction.stringIndex]} text-white`}
                  >
                    <span className="text-3xl font-bold">{prediction.stringLabel}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-semibold">{STRING_NAMES[prediction.stringIndex]}</p>
                    <p className="text-muted-foreground">
                      Confidence: {(prediction.confidence * 100).toFixed(1)}%
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Fundamental: {prediction.features.fundamental.toFixed(1)} Hz
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">String Probabilities</p>
                  <div className="grid grid-cols-6 gap-2">
                    {prediction.allProbabilities.map((prob, idx) => (
                      <div key={idx} className="text-center">
                        <div className="bg-muted relative h-32 w-full rounded-md">
                          <div
                            className={`absolute bottom-0 w-full rounded-md transition-all ${STRING_COLORS[idx]}`}
                            style={{ height: `${prob * 100}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs font-medium">
                          {["E2", "A2", "D3", "G3", "B3", "E4"][idx]}
                        </p>
                        <p className="text-muted-foreground text-xs">{(prob * 100).toFixed(0)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground flex h-40 items-center justify-center">
                {isRecording ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Waiting for audio signal...
                  </div>
                ) : (
                  "No prediction yet"
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {prediction && (
          <Card>
            <CardHeader>
              <CardTitle>Extracted Features</CardTitle>
              <CardDescription>Audio features used for classification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <FeatureItem
                  label="Spectral Centroid"
                  value={`${prediction.features.spectralCentroid.toFixed(0)} Hz`}
                />
                <FeatureItem
                  label="Spectral Rolloff"
                  value={`${prediction.features.spectralRolloff.toFixed(0)} Hz`}
                />
                <FeatureItem
                  label="Energy Slope"
                  value={prediction.features.energySlope.toFixed(4)}
                />
                <FeatureItem
                  label="Inharmonicity"
                  value={prediction.features.inharmonicity.toFixed(4)}
                />
                <FeatureItem label="RMS Energy" value={prediction.features.rmsEnergy.toFixed(4)} />
                <FeatureItem
                  label="Fundamental"
                  value={`${prediction.features.fundamental.toFixed(1)} Hz`}
                />
              </div>
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">Harmonic Ratios</p>
                <div className="flex flex-wrap gap-1">
                  {prediction.features.harmonicRatios.map((ratio, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      H{idx + 1}: {ratio.toFixed(2)}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Prediction History</CardTitle>
              <CardDescription>Recent predictions (most recent first)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {history.map((pred, idx) => (
                  <Badge key={idx} className={`${STRING_COLORS[pred.stringIndex]} text-white`}>
                    {pred.stringLabel} ({(pred.confidence * 100).toFixed(0)}%)
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function FeatureItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted rounded-md p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-mono text-sm font-medium">{value}</p>
    </div>
  )
}
