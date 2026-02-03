"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSampleRecorder, type RecordedSample } from "@/hooks/useSampleRecorder"
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Guitar,
  Loader2,
  Mic,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

const STRING_NAMES = ["E", "A", "D", "G", "B", "e"] as const
const STRING_DESCRIPTIONS = [
  "Low E (thickest string)",
  "A string",
  "D string",
  "G string",
  "B string",
  "High e (thinnest string)",
] as const

// ============ EASILY CONFIGURABLE ============
// Adjust these to find optimal balance between accuracy and UX
// const FRET_POSITIONS = [0, 5, 12]
// we have done 0 5 12
const FRET_POSITIONS = [1, 4, 7, 11]
const SAMPLES_PER_POSITION = 5
// Total: 6 strings × 3 frets × 3 samples = 54 samples
// ==============================================

const getFretLabel = (fret: number) => (fret === 0 ? "Open" : `Fret ${fret}`)

type PersonalizationStep = "intro" | "recording" | "processing" | "complete"

interface StringSamples {
  stringIndex: number
  fretPosition: number
  samples: RecordedSample[]
}

export default function PersonalizePage() {
  const [step, setStep] = useState<PersonalizationStep>("intro")
  const [currentStringIndex, setCurrentStringIndex] = useState(0)
  const [currentFretPosition, setCurrentFretPosition] = useState(0)
  const [allStringSamples, setAllStringSamples] = useState<StringSamples[]>([])
  const [playingSampleKey, setPlayingSampleKey] = useState<string | null>(null)
  const [processingStatus, setProcessingStatus] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const {
    sessionState,
    recordingPhase,
    currentSampleIndex,
    samples,
    error: recorderError,
    isClipping,
    startSession,
    stopSession,
    discardSession,
    getSampleBlob,
  } = useSampleRecorder({
    samplesPerSession: SAMPLES_PER_POSITION,
  })

  useEffect(() => {
    const storedUserId = localStorage.getItem("stringflow_user_id")
    if (storedUserId) {
      setUserId(storedUserId)
    }
  }, [])

  const currentFretIndex = FRET_POSITIONS.indexOf(currentFretPosition)

  const handleStartRecording = () => {
    setCurrentStringIndex(0)
    setCurrentFretPosition(FRET_POSITIONS[0])
    setAllStringSamples([])
    setError(null)
    setStep("recording")
    startSession()
  }

  useEffect(() => {
    if (step !== "recording" || sessionState !== "preview" || samples.length === 0) return

    const newStringSamples: StringSamples = {
      stringIndex: currentStringIndex,
      fretPosition: currentFretPosition,
      samples: [...samples],
    }

    setAllStringSamples((prev) => {
      const filtered = prev.filter(
        (s) => !(s.stringIndex === currentStringIndex && s.fretPosition === currentFretPosition),
      )
      return [...filtered, newStringSamples]
    })
  }, [sessionState, samples, currentStringIndex, currentFretPosition, step])

  useEffect(() => {
    if (step !== "recording" || sessionState !== "preview") return
    if (currentStringIndex >= 5) return

    const timer = setTimeout(() => {
      setCurrentStringIndex(currentStringIndex + 1)
      discardSession()
      setTimeout(() => startSession(), 200)
    }, 500)

    return () => clearTimeout(timer)
  }, [sessionState, currentStringIndex, step, discardSession, startSession])

  const handleNextFretPosition = () => {
    if (currentFretIndex < FRET_POSITIONS.length - 1) {
      setCurrentStringIndex(0)
      setCurrentFretPosition(FRET_POSITIONS[currentFretIndex + 1])
      discardSession()
      setTimeout(() => startSession(), 200)
    }
  }

  const handleRerecordString = () => {
    setAllStringSamples((prev) =>
      prev.filter(
        (s) => !(s.stringIndex === currentStringIndex && s.fretPosition === currentFretPosition),
      ),
    )
    discardSession()
    setTimeout(() => startSession(), 200)
  }

  const handlePlaySample = (stringIndex: number, fretPosition: number, sample: RecordedSample) => {
    const sampleKey = `${stringIndex}-${fretPosition}-${sample.index}`

    if (playingSampleKey === sampleKey) {
      audioRef.current?.pause()
      setPlayingSampleKey(null)
      return
    }

    const stringSamples = allStringSamples.find(
      (s) => s.stringIndex === stringIndex && s.fretPosition === fretPosition,
    )
    if (!stringSamples) return

    const originalSample = stringSamples.samples.find((s) => s.index === sample.index)
    if (!originalSample) return

    const blob = getSampleBlob(originalSample)
    const url = URL.createObjectURL(blob)

    if (audioRef.current) {
      audioRef.current.pause()
      URL.revokeObjectURL(audioRef.current.src)
    }

    const audio = new Audio(url)
    audioRef.current = audio
    setPlayingSampleKey(sampleKey)

    audio.onended = () => {
      setPlayingSampleKey(null)
      URL.revokeObjectURL(url)
    }

    audio.play()
  }

  const handleSubmitSamples = async () => {
    setStep("processing")
    setProcessingStatus("Preparing samples...")
    setError(null)

    try {
      const formData = new FormData()

      for (const stringSamples of allStringSamples) {
        for (const sample of stringSamples.samples) {
          const blob = getSampleBlob(sample)
          formData.append(
            `sample_${stringSamples.stringIndex}_${stringSamples.fretPosition}_${sample.index}`,
            blob,
            `sample_${stringSamples.stringIndex}_${stringSamples.fretPosition}_${sample.index}.wav`,
          )
        }
      }

      if (userId) {
        formData.append("userId", userId)
      }

      setProcessingStatus("Uploading samples and fine-tuning model...")

      const response = await fetch("/recorder/finetune", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Fine-tuning failed")
      }

      const result = await response.json()

      localStorage.setItem("stringflow_user_id", result.userId)
      localStorage.setItem("stringflow_custom_model", result.modelPath)
      localStorage.setItem("stringflow_custom_scaler", result.scalerPath)

      setUserId(result.userId)
      setStep("complete")
    } catch (err) {
      console.error("Fine-tuning error:", err)
      setError(err instanceof Error ? err.message : "Fine-tuning failed")
      setStep("recording")
    }
  }

  const handleReset = () => {
    localStorage.removeItem("stringflow_custom_model")
    localStorage.removeItem("stringflow_custom_scaler")
    setStep("intro")
    setAllStringSamples([])
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
        return <Mic className="size-8 animate-pulse text-red-500" />
      default:
        return null
    }
  }

  const totalSamplesCollected = allStringSamples.reduce((sum, s) => sum + s.samples.length, 0)
  const totalSamplesNeeded = 6 * SAMPLES_PER_POSITION * FRET_POSITIONS.length
  const isAllStringsComplete =
    allStringSamples.length === 6 * FRET_POSITIONS.length && sessionState === "preview"
  const isLastStringAndFret =
    currentStringIndex === 5 && currentFretIndex === FRET_POSITIONS.length - 1

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Personalize StringFlow</h1>
        <p className="text-muted-foreground">
          Adapt the string classifier to your specific guitar and setup
        </p>
      </div>

      <Tabs value={step} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="intro" disabled>
            1. Intro
          </TabsTrigger>
          <TabsTrigger value="recording" disabled>
            2. Record
          </TabsTrigger>
          <TabsTrigger value="processing" disabled>
            3. Process
          </TabsTrigger>
          <TabsTrigger value="complete" disabled>
            4. Done
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intro" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Guitar className="size-5" />
                Personalize Your Experience
              </CardTitle>
              <CardDescription>
                Record a few samples of each string to fine-tune the classifier for your guitar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-medium">How it works:</h3>
                <ol className="text-muted-foreground list-inside list-decimal space-y-2 text-sm">
                  <li>
                    Record {SAMPLES_PER_POSITION} samples of each string at {FRET_POSITIONS.length}{" "}
                    positions: {FRET_POSITIONS.map(getFretLabel).join(", ")} ({totalSamplesNeeded}{" "}
                    total)
                  </li>
                  <li>Our system extracts audio features from your samples</li>
                  <li>The model adapts to recognize your guitar's unique sound</li>
                  <li>You get better accuracy tailored to your setup!</li>
                </ol>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="mb-2 font-medium">Tips for best results:</h4>
                <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                  <li>Use the same guitar and amp settings you normally play with</li>
                  <li>Record in a quiet environment</li>
                  <li>Pluck each string cleanly, letting it ring for a moment</li>
                  <li>Mute the string completely before the next sample</li>
                </ul>
              </div>

              {userId && (
                <div className="bg-primary/10 text-primary rounded-lg p-3 text-sm">
                  You already have a personalized model. Recording new samples will replace it.
                </div>
              )}

              <Button onClick={handleStartRecording} className="w-full" size="lg">
                Start Recording
                <ChevronRight className="ml-2 size-4" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recording" className="mt-6 space-y-4">
          {sessionState === "recording" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Recording: {STRING_NAMES[currentStringIndex]} String (
                  {getFretLabel(currentFretPosition)})
                </CardTitle>
                <CardDescription>
                  {STRING_DESCRIPTIONS[currentStringIndex]} - Sample {currentSampleIndex + 1} of{" "}
                  {SAMPLES_PER_POSITION}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isClipping && (
                  <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3">
                    <AlertTriangle className="size-5 shrink-0" />
                    <p className="text-sm font-medium">
                      Input clipping detected - reduce microphone gain
                    </p>
                  </div>
                )}

                <div className="flex flex-col items-center justify-center space-y-4 py-8">
                  {getPhaseIcon()}
                  <p className="text-xl font-medium">{getPhaseMessage()}</p>
                  <div className="flex gap-1">
                    {Array.from({ length: SAMPLES_PER_POSITION }, (_, i) => (
                      <div
                        key={i}
                        className={`h-3 w-3 rounded-full ${
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

                <div className="flex justify-between">
                  <Button variant="outline" onClick={stopSession}>
                    Cancel
                  </Button>
                  <div className="text-muted-foreground text-sm">
                    {getFretLabel(currentFretPosition)} - String {currentStringIndex + 1} of 6
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {sessionState === "preview" && currentStringIndex < 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="text-primary size-5" />
                  {STRING_NAMES[currentStringIndex]} String ({getFretLabel(currentFretPosition)})
                  Complete
                </CardTitle>
                <CardDescription>
                  Continuing to {STRING_NAMES[currentStringIndex + 1]} string...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="text-muted-foreground size-5 animate-spin" />
                </div>
              </CardContent>
            </Card>
          )}

          {sessionState === "preview" && currentStringIndex === 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="text-primary size-5" />
                  {getFretLabel(currentFretPosition)} Complete!
                </CardTitle>
                <CardDescription>
                  All 6 strings recorded at {getFretLabel(currentFretPosition).toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {isLastStringAndFret ? (
                    <Button onClick={handleSubmitSamples} className="flex-1">
                      Finish & Process
                      <ChevronRight className="ml-2 size-4" />
                    </Button>
                  ) : (
                    <Button onClick={handleNextFretPosition} className="flex-1">
                      Continue to {getFretLabel(FRET_POSITIONS[currentFretIndex + 1])}
                      <ChevronRight className="ml-2 size-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {recorderError && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
              {recorderError}
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{error}</div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {FRET_POSITIONS.map((fret) => (
                  <div key={fret} className="space-y-2">
                    <h4 className="text-muted-foreground text-sm font-medium">
                      {getFretLabel(fret)}
                    </h4>
                    <div className="space-y-2">
                      {STRING_NAMES.map((name, stringIdx) => {
                        const stringSamples = allStringSamples.find(
                          (s) => s.stringIndex === stringIdx && s.fretPosition === fret,
                        )
                        const isComplete =
                          stringSamples && stringSamples.samples.length === SAMPLES_PER_POSITION
                        const isCurrent =
                          stringIdx === currentStringIndex && fret === currentFretPosition

                        return (
                          <div key={`${fret}-${stringIdx}`} className="flex items-center gap-3">
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                                isComplete
                                  ? "bg-primary text-primary-foreground"
                                  : isCurrent
                                    ? "bg-primary/20 text-primary"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {isComplete ? <Check className="size-3" /> : name}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm ${isCurrent ? "font-medium" : ""}`}>
                                {STRING_DESCRIPTIONS[stringIdx]}
                              </p>
                            </div>
                            {isComplete && (
                              <div className="flex gap-1">
                                {stringSamples.samples.map((sample) => (
                                  <Button
                                    key={sample.index}
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handlePlaySample(stringIdx, fret, sample)}
                                  >
                                    {playingSampleKey === `${stringIdx}-${fret}-${sample.index}` ? (
                                      <Pause className="size-3" />
                                    ) : (
                                      <Play className="size-3" />
                                    )}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total samples:</span>
                  <span className="font-medium">
                    {totalSamplesCollected} / {totalSamplesNeeded}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="size-5 animate-spin" />
                Processing...
              </CardTitle>
              <CardDescription>
                This may take a minute. Please don't close this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm">{processingStatus}</p>
                </div>

                <div className="text-muted-foreground text-sm">
                  We're extracting features from your {totalSamplesCollected} samples and
                  fine-tuning the model to recognize your guitar's unique characteristics.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="complete" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Check className="size-5" />
                Personalization Complete!
              </CardTitle>
              <CardDescription>Your custom model is ready to use</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950">
                <p className="text-sm text-green-800 dark:text-green-200">
                  StringFlow has been personalized for your guitar. The classifier will now use your
                  custom model for better accuracy.
                </p>
              </div>

              <div className="text-muted-foreground text-sm">
                <p>
                  <strong>User ID:</strong> {userId}
                </p>
                <p className="mt-1">
                  Your personalized model is stored in your browser. You can re-personalize anytime
                  to update it with new samples.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset}>
                  Reset to Default
                </Button>
                <Button asChild className="flex-1">
                  <a href="/">Start Playing</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
