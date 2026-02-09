"use client"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSpectrogramClassifier } from "@/hooks/useSpectrogramClassifier"
import {
  AlertCircle,
  AudioWaveform,
  CheckCircle2,
  Download,
  Loader2,
  Mic,
  MicOff,
} from "lucide-react"
import { useEffect, useMemo } from "react"

const STRING_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-blue-500",
  "bg-purple-500",
]

const STRING_NAMES = ["E2 (Low)", "A2", "D3", "G3", "B3", "E4 (High)"]

export default function SpecTestPage() {
  const {
    status,
    error,
    prediction,
    startListening,
    stopListening,
    loadModel,
    isModelLoaded,
    captureDebugData,
  } = useSpectrogramClassifier({
    minConfidence: 0.95,
  })

  const handleCaptureData = () => {
    const debugData = captureDebugData()
    if (!debugData) {
      alert("No data to capture. Play a note first!")
      return
    }

    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `spectrogram_debug_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const isRecording = status === "recording"
  const isLoading = status === "loading"

  const fretboardMarkers = useMemo((): Marker[] => {
    if (!prediction) return []
    return [
      {
        stringIndex: prediction.stringIndex,
        fretIndex: prediction.fret,
        type: "played",
        label: prediction.stringLabel,
      },
    ]
  }, [prediction])

  useEffect(() => {
    const loadThings = async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      await loadModel()
      await new Promise((resolve) => setTimeout(resolve, 200))
      await startListening()
    }
    loadThings().catch(console.error)
  }, [])

  return (
    <div className="bg-background min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Spectrogram Classifier Test</h1>
          <p className="text-muted-foreground mt-2">
            Real-time guitar string detection using mel-spectrogram CNN
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
                ? "Spectrogram model loaded and ready"
                : "Load the ONNX model to start"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {!isModelLoaded && (
                <Button onClick={loadModel} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <AudioWaveform className="mr-2 h-4 w-4" />
                  Load Spectrogram Model
                </Button>
              )}
              <Button
                onClick={isRecording ? stopListening : startListening}
                variant={isRecording ? "destructive" : "default"}
                disabled={isLoading || !isModelLoaded}
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
              <Button onClick={handleCaptureData} variant="outline" disabled={!isRecording}>
                <Download className="mr-2 h-4 w-4" />
                Capture Data
              </Button>
            </div>
            {error && (
              <div className="bg-destructive/10 text-destructive mt-4 rounded-md p-3">{error}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live Fretboard</CardTitle>
            <CardDescription>
              {prediction
                ? `${prediction.stringLabel} string, fret ${prediction.fret} (${prediction.fundamental.toFixed(1)} Hz)`
                : "Play a note to see it on the fretboard"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Fretboard markers={fretboardMarkers} className="w-full" />

            <div className="mt-4 flex h-8 items-center justify-center gap-4">
              {prediction && (
                <span className="text-muted-foreground text-sm">
                  Confidence: {(prediction.confidence * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>String Probabilities</CardTitle>
            <CardDescription>
              {isRecording ? "Listening for guitar notes..." : "Start listening to see predictions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {prediction ? (
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
              <CardTitle>Current Detection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-4">
                <div
                  className={`flex h-24 w-24 items-center justify-center rounded-full ${STRING_COLORS[prediction.stringIndex]} text-white`}
                >
                  <span className="text-3xl font-bold">{prediction.stringLabel}</span>
                </div>
                <div className="text-left">
                  <p className="text-2xl font-semibold">{STRING_NAMES[prediction.stringIndex]}</p>
                  <p className="text-muted-foreground">
                    Fret {prediction.fret} &middot; {prediction.fundamental.toFixed(1)} Hz
                  </p>
                  <Badge variant="outline" className="mt-1">
                    {(prediction.confidence * 100).toFixed(1)}% confident
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
