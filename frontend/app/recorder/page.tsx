"use client"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSampleRecorder, type RecordedSample } from "@/hooks/useSampleRecorder"
import { AlertTriangle, Mic, Pause, Play, Save, Trash2, Volume2, VolumeX } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

const STRING_NAMES = ["E", "A", "D", "G", "B", "e"] as const
const FRET_COUNT = 19

type SampleCounts = Record<string, number>

export default function RecorderPage() {
  const [selectedString, setSelectedString] = useState<string>("")
  const [selectedFret, setSelectedFret] = useState<string>("")
  const [sampleCounts, setSampleCounts] = useState<SampleCounts>({})
  const [isSaving, setIsSaving] = useState(false)
  const [playingSampleIndex, setPlayingSampleIndex] = useState<number | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const {
    sessionState,
    recordingPhase,
    currentSampleIndex,
    samples,
    error,
    isClipping,
    startSession,
    stopSession,
    discardSession,
    getSampleBlob,
  } = useSampleRecorder()

  const fetchSampleCounts = useCallback(async () => {
    try {
      const response = await fetch("/recorder/view")
      if (response.ok) {
        const data = await response.json()
        setSampleCounts(data.counts ?? {})
      }
    } catch (err) {
      console.error("Failed to fetch sample counts:", err)
    }
  }, [])

  useEffect(() => {
    fetchSampleCounts()
  }, [fetchSampleCounts])

  const handleStartRecording = () => {
    startSession()
  }

  const handleSaveSamples = async () => {
    if (samples.length === 0 || !selectedString || !selectedFret) return

    setIsSaving(true)
    try {
      const formData = new FormData()
      formData.append("string", selectedString)
      formData.append("fret", selectedFret)

      for (const sample of samples) {
        const blob = getSampleBlob(sample)
        formData.append(`sample_${sample.index}`, blob, `sample_${sample.index}.wav`)
      }

      const response = await fetch("/recorder/create", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to save samples")
      }

      discardSession()
      setSelectedString("")
      setSelectedFret("")
      fetchSampleCounts()
    } catch (err) {
      console.error("Failed to save samples:", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePlaySample = (sample: RecordedSample) => {
    if (playingSampleIndex === sample.index) {
      audioRef.current?.pause()
      setPlayingSampleIndex(null)
      return
    }

    const blob = getSampleBlob(sample)
    const url = URL.createObjectURL(blob)

    if (audioRef.current) {
      audioRef.current.pause()
      URL.revokeObjectURL(audioRef.current.src)
    }

    const audio = new Audio(url)
    audioRef.current = audio
    setPlayingSampleIndex(sample.index)

    audio.onended = () => {
      setPlayingSampleIndex(null)
      URL.revokeObjectURL(url)
    }

    audio.play()
  }

  const handleDiscard = () => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setPlayingSampleIndex(null)
    discardSession()
  }

  const getPhaseMessage = () => {
    switch (recordingPhase) {
      case "waiting-for-silence":
        return "Waiting for silence..."
      case "ready-to-pluck":
        return "Pluck the string now!"
      case "recording":
        return "Recording..."
      case "waiting-for-mute":
        return "Mute the string"
      default:
        return ""
    }
  }

  const getPhaseIcon = () => {
    switch (recordingPhase) {
      case "waiting-for-silence":
      case "waiting-for-mute":
        return <VolumeX className="size-8" />
      case "ready-to-pluck":
        return <Volume2 className="size-8 animate-pulse" />
      case "recording":
        return <Mic className="size-8 text-red-500 animate-pulse" />
      default:
        return null
    }
  }

  const fretboardMarkers: Marker[] = Object.entries(sampleCounts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => {
      const [stringIndex, fretIndex] = key.split("-").map(Number)
      return {
        stringIndex,
        fretIndex,
        type: "note" as const,
        label: String(count),
      }
    })

  const canStartRecording = selectedString !== "" && selectedFret !== "" && sessionState === "idle"

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Sample Recorder</h1>
        <p className="text-muted-foreground">
          Record guitar samples for neural network training
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sample Coverage</CardTitle>
          <CardDescription>
            Number of samples recorded at each fret position
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Fretboard markers={fretboardMarkers} className="w-full" />
        </CardContent>
      </Card>

      {sessionState === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle>New Recording Session</CardTitle>
            <CardDescription>
              Select a string and fret position to record 10 samples
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <div className="space-y-2">
                <label className="text-sm font-medium">String</label>
                <Select value={selectedString} onValueChange={setSelectedString}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {STRING_NAMES.map((name, index) => (
                      <SelectItem key={index} value={String(index)}>
                        {name} (String {index + 1})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fret</label>
                <Select value={selectedFret} onValueChange={setSelectedFret}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: FRET_COUNT }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i === 0 ? "Open" : `Fret ${i}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleStartRecording} disabled={!canStartRecording}>
              <Mic className="mr-2" />
              Start Recording
            </Button>
          </CardContent>
        </Card>
      )}

      {sessionState === "recording" && (
        <Card>
          <CardHeader>
            <CardTitle>Recording Session</CardTitle>
            <CardDescription>
              Sample {currentSampleIndex + 1} of 10 &bull;{" "}
              {STRING_NAMES[Number(selectedString)]} string, fret {selectedFret}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isClipping && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5 shrink-0" />
                <p className="text-sm font-medium">
                  Input clipping detected - reduce microphone gain or move further from the mic
                </p>
              </div>
            )}

            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              {getPhaseIcon()}
              <p className="text-xl font-medium">{getPhaseMessage()}</p>
              <div className="flex gap-1">
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${
                      i < currentSampleIndex
                        ? "bg-primary"
                        : i === currentSampleIndex
                          ? "bg-primary animate-pulse"
                          : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>

            <Button variant="outline" onClick={stopSession}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {sessionState === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Samples</CardTitle>
            <CardDescription>
              {samples.length} samples recorded for {STRING_NAMES[Number(selectedString)]} string,
              fret {selectedFret}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {samples.map((sample) => (
                <Button
                  key={sample.index}
                  variant={playingSampleIndex === sample.index ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePlaySample(sample)}
                >
                  {playingSampleIndex === sample.index ? (
                    <Pause className="mr-1 size-3" />
                  ) : (
                    <Play className="mr-1 size-3" />
                  )}
                  {sample.index + 1}
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveSamples} disabled={isSaving} isLoading={isSaving}>
                <Save className="mr-2" />
                Save Samples
              </Button>
              <Button variant="outline" onClick={handleDiscard}>
                <Trash2 className="mr-2" />
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
