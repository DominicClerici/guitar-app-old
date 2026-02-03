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
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSampleRecorder, type RecordedSample } from "@/hooks/useSampleRecorder"
import { AlertTriangle, Mic, Pause, Play, Save, Trash2, Volume2, VolumeX } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

const STRING_NAMES = ["E", "A", "D", "G", "B", "e"] as const
const FRET_COUNT = 19

type SampleCounts = Record<string, number>

const SAMPLES_PER_SESSION = 3
const SUSTAIN_RECORD_DURATION_MS = 1300
const SUSTAIN_TRIM_START_MS = 200
const SUSTAIN_TRIM_END_MS = 1200

export default function RecorderPage() {
  const [activeTab, setActiveTab] = useState<string>("notes")
  const [selectedString, setSelectedString] = useState<string>("")
  const [selectedFret, setSelectedFret] = useState<string>("")
  const [sampleCounts, setSampleCounts] = useState<SampleCounts>({})
  const [sustainCounts, setSustainCounts] = useState<SampleCounts>({})
  const [isSaving, setIsSaving] = useState(false)
  const [playingSampleIndex, setPlayingSampleIndex] = useState<number | null>(null)

  const [recordAllStrings, setRecordAllStrings] = useState(false)
  const [isMultiStringActive, setIsMultiStringActive] = useState(false)
  const [currentMultiStringIndex, setCurrentMultiStringIndex] = useState(0)
  const allStringSamplesRef = useRef<Map<number, RecordedSample[]>>(new Map())

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const noteRecorder = useSampleRecorder({
    samplesPerSession: SAMPLES_PER_SESSION,
  })

  const sustainRecorder = useSampleRecorder({
    samplesPerSession: SAMPLES_PER_SESSION,
    recordDurationMs: SUSTAIN_RECORD_DURATION_MS,
    preRollDurationMs: 0,
  })

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
    getTrimmedSampleBlob,
  } = activeTab === "sustain" ? sustainRecorder : noteRecorder

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

  const fetchSustainCounts = useCallback(async () => {
    try {
      const response = await fetch("/recorder/sustain")
      if (response.ok) {
        const data = await response.json()
        setSustainCounts(data.counts ?? {})
      }
    } catch (err) {
      console.error("Failed to fetch sustain sample counts:", err)
    }
  }, [])

  useEffect(() => {
    fetchSampleCounts()
    fetchSustainCounts()
  }, [fetchSampleCounts, fetchSustainCounts])

  useEffect(() => {
    if (!isMultiStringActive || sessionState !== "preview" || samples.length === 0) return

    const newMap = new Map(allStringSamplesRef.current)
    newMap.set(currentMultiStringIndex, [...samples])
    allStringSamplesRef.current = newMap

    if (currentMultiStringIndex < 5) {
      const nextIndex = currentMultiStringIndex + 1
      setCurrentMultiStringIndex(nextIndex)
      setSelectedString(String(nextIndex))
      discardSession()
      setTimeout(() => startSession(), 300)
    } else {
      setIsMultiStringActive(false)
    }
  }, [
    sessionState,
    samples,
    isMultiStringActive,
    currentMultiStringIndex,
    discardSession,
    startSession,
  ])

  const handleStartRecording = () => {
    if (activeTab === "sustain" || recordAllStrings) {
      setIsMultiStringActive(true)
      setCurrentMultiStringIndex(0)
      setSelectedString("0")
      allStringSamplesRef.current = new Map()
    }
    startSession()
  }

  const isMultiStringPreview =
    (activeTab === "sustain" || recordAllStrings) &&
    !isMultiStringActive &&
    allStringSamplesRef.current.size === 6

  const previewSamplesByString = useMemo(() => {
    if (isMultiStringPreview) {
      return allStringSamplesRef.current
    }
    const map = new Map<number, RecordedSample[]>()
    if (samples.length > 0) {
      map.set(Number(selectedString), samples)
    }
    return map
  }, [isMultiStringPreview, samples, selectedString])

  const handleSaveSamples = async () => {
    if (activeTab === "sustain") {
      if (previewSamplesByString.size === 0) return

      setIsSaving(true)
      try {
        const savePromises = Array.from(previewSamplesByString.entries()).map(
          async ([stringIndex, stringSamples]) => {
            const formData = new FormData()
            formData.append("string", String(stringIndex))

            for (const sample of stringSamples) {
              const blob = getTrimmedSampleBlob(sample, {
                trimStartMs: SUSTAIN_TRIM_START_MS,
                trimEndMs: SUSTAIN_TRIM_END_MS,
              })
              formData.append(`sample_${sample.index}`, blob, `sample_${sample.index}.wav`)
            }

            const response = await fetch("/recorder/sustain", {
              method: "POST",
              body: formData,
            })

            if (!response.ok) {
              throw new Error(`Failed to save sustain samples for string ${stringIndex}`)
            }
          },
        )

        await Promise.all(savePromises)

        allStringSamplesRef.current = new Map()
        discardSession()
        fetchSustainCounts()
      } catch (err) {
        console.error("Failed to save sustain samples:", err)
      } finally {
        setIsSaving(false)
      }
    } else {
      if (previewSamplesByString.size === 0 || !selectedFret) return

      setIsSaving(true)
      try {
        const savePromises = Array.from(previewSamplesByString.entries()).map(
          async ([stringIndex, stringSamples]) => {
            const formData = new FormData()
            formData.append("string", String(stringIndex))
            formData.append("fret", selectedFret)

            for (const sample of stringSamples) {
              const blob = getSampleBlob(sample)
              formData.append(`sample_${sample.index}`, blob, `sample_${sample.index}.wav`)
            }

            const response = await fetch("/recorder/create", {
              method: "POST",
              body: formData,
            })

            if (!response.ok) {
              throw new Error(`Failed to save samples for string ${stringIndex}`)
            }
          },
        )

        await Promise.all(savePromises)

        allStringSamplesRef.current = new Map()
        discardSession()
        fetchSampleCounts()
      } catch (err) {
        console.error("Failed to save samples:", err)
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handlePlaySample = (sample: RecordedSample) => {
    if (playingSampleIndex === sample.index) {
      audioRef.current?.pause()
      setPlayingSampleIndex(null)
      return
    }

    const blob =
      activeTab === "sustain"
        ? getTrimmedSampleBlob(sample, {
            trimStartMs: SUSTAIN_TRIM_START_MS,
            trimEndMs: SUSTAIN_TRIM_END_MS,
          })
        : getSampleBlob(sample)
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
    allStringSamplesRef.current = new Map()
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

  const canStartRecording =
    activeTab === "sustain"
      ? sessionState === "idle"
      : (recordAllStrings || selectedString !== "") &&
        selectedFret !== "" &&
        sessionState === "idle"

  const sustainStringMarkers: Marker[] = Object.entries(sustainCounts)
    .filter(([, count]) => count > 0)
    .map(([stringIndex, count]) => ({
      stringIndex: Number(stringIndex),
      fretIndex: 0,
      type: "note" as const,
      label: String(count),
    }))

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Sample Recorder</h1>
        <p className="text-muted-foreground">Record guitar samples for neural network training</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="notes">Note Samples</TabsTrigger>
          <TabsTrigger value="sustain">Sustain Samples</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sample Coverage</CardTitle>
              <CardDescription>Number of samples recorded at each fret position</CardDescription>
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
                  Select a string and fret position to record {SAMPLES_PER_SESSION} samples
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-4">
                  {!recordAllStrings && (
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
                  )}

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

                  <div className="flex items-center gap-2 pb-0.5">
                    <Switch
                      id="record-all-strings"
                      checked={recordAllStrings}
                      onCheckedChange={setRecordAllStrings}
                    />
                    <label htmlFor="record-all-strings" className="text-sm font-medium">
                      Record all strings
                    </label>
                  </div>
                </div>

                {error && <p className="text-destructive text-sm">{error}</p>}

                <Button onClick={handleStartRecording} disabled={!canStartRecording}>
                  <Mic className="mr-2" />
                  Start Recording
                </Button>
              </CardContent>
            </Card>
          )}

          {(sessionState === "recording" || isMultiStringActive) && (
            <Card>
              <CardHeader>
                <CardTitle>Recording Session</CardTitle>
                <CardDescription>
                  {isMultiStringActive && <>String {currentMultiStringIndex + 1} of 6 &bull; </>}
                  Sample {currentSampleIndex + 1} of {SAMPLES_PER_SESSION} &bull;{" "}
                  {STRING_NAMES[Number(selectedString)]} string, fret {selectedFret}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isClipping && (
                  <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3">
                    <AlertTriangle className="size-5 shrink-0" />
                    <p className="text-sm font-medium">
                      Input clipping detected - reduce microphone gain or move further from the mic
                    </p>
                  </div>
                )}

                <div className="flex flex-col items-center justify-center space-y-4 py-8">
                  {getPhaseIcon()}
                  <p className="text-xl font-medium">{getPhaseMessage()}</p>
                  <div className="flex gap-1">
                    {Array.from({ length: SAMPLES_PER_SESSION }, (_, i) => (
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

                <Button variant="outline" onClick={stopSession}>
                  Cancel
                </Button>
              </CardContent>
            </Card>
          )}

          {sessionState === "preview" && !isMultiStringActive && (
            <Card>
              <CardHeader>
                <CardTitle>Preview Samples</CardTitle>
                <CardDescription>
                  {isMultiStringPreview ? (
                    <>
                      {Array.from(previewSamplesByString.values()).reduce(
                        (sum, s) => sum + s.length,
                        0,
                      )}{" "}
                      samples recorded across all strings, fret {selectedFret}
                    </>
                  ) : (
                    <>
                      {samples.length} samples recorded for {STRING_NAMES[Number(selectedString)]}{" "}
                      string, fret {selectedFret}
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isMultiStringPreview ? (
                  <div className="space-y-3">
                    {Array.from(previewSamplesByString.entries()).map(
                      ([stringIndex, stringSamples]) => (
                        <div key={stringIndex} className="space-y-2">
                          <p className="text-sm font-medium">
                            {STRING_NAMES[stringIndex]} string ({stringSamples.length} samples)
                          </p>
                          <div className="grid grid-cols-5 gap-2">
                            {stringSamples.map((sample) => {
                              const uniqueKey = `${stringIndex}-${sample.index}`
                              return (
                                <Button
                                  key={uniqueKey}
                                  variant={
                                    playingSampleIndex === stringIndex * 100 + sample.index
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    handlePlaySample({
                                      ...sample,
                                      index: stringIndex * 100 + sample.index,
                                    })
                                  }
                                >
                                  {playingSampleIndex === stringIndex * 100 + sample.index ? (
                                    <Pause className="mr-1 size-3" />
                                  ) : (
                                    <Play className="mr-1 size-3" />
                                  )}
                                  {sample.index + 1}
                                </Button>
                              )
                            })}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
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
                )}

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
        </TabsContent>

        <TabsContent value="sustain" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sustain Sample Coverage</CardTitle>
              <CardDescription>
                Number of sustain samples recorded for each open string (200ms-1200ms after pluck)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Fretboard markers={sustainStringMarkers} className="w-full" />
            </CardContent>
          </Card>

          {sessionState === "idle" && (
            <Card>
              <CardHeader>
                <CardTitle>New Sustain Recording Session</CardTitle>
                <CardDescription>
                  Record {SAMPLES_PER_SESSION} sustain samples for each open string. Captures the
                  sustained portion of the note (200ms-1200ms after pluck).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && <p className="text-destructive text-sm">{error}</p>}

                <Button onClick={handleStartRecording} disabled={!canStartRecording}>
                  <Mic className="mr-2" />
                  Start Recording All Strings
                </Button>
              </CardContent>
            </Card>
          )}

          {(sessionState === "recording" || isMultiStringActive) && (
            <Card>
              <CardHeader>
                <CardTitle>Recording Sustain Samples</CardTitle>
                <CardDescription>
                  String {currentMultiStringIndex + 1} of 6 ({STRING_NAMES[currentMultiStringIndex]}
                  ) &bull; Sample {currentSampleIndex + 1} of {SAMPLES_PER_SESSION}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isClipping && (
                  <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3">
                    <AlertTriangle className="size-5 shrink-0" />
                    <p className="text-sm font-medium">
                      Input clipping detected - reduce microphone gain or move further from the mic
                    </p>
                  </div>
                )}

                <div className="flex flex-col items-center justify-center space-y-4 py-8">
                  {getPhaseIcon()}
                  <p className="text-xl font-medium">{getPhaseMessage()}</p>
                  <div className="flex gap-1">
                    {Array.from({ length: SAMPLES_PER_SESSION }, (_, i) => (
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
                  <div className="flex gap-2 pt-2">
                    {STRING_NAMES.map((name, i) => (
                      <div
                        key={i}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                          i < currentMultiStringIndex
                            ? "bg-primary text-primary-foreground"
                            : i === currentMultiStringIndex
                              ? "bg-primary text-primary-foreground animate-pulse"
                              : "bg-muted"
                        }`}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                </div>

                <Button variant="outline" onClick={stopSession}>
                  Cancel
                </Button>
              </CardContent>
            </Card>
          )}

          {sessionState === "preview" && !isMultiStringActive && (
            <Card>
              <CardHeader>
                <CardTitle>Preview Sustain Samples</CardTitle>
                <CardDescription>
                  {Array.from(previewSamplesByString.values()).reduce(
                    (sum, s) => sum + s.length,
                    0,
                  )}{" "}
                  sustain samples recorded across all open strings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {Array.from(previewSamplesByString.entries()).map(
                    ([stringIndex, stringSamples]) => (
                      <div key={stringIndex} className="space-y-2">
                        <p className="text-sm font-medium">
                          {STRING_NAMES[stringIndex]} string ({stringSamples.length} samples)
                        </p>
                        <div className="grid grid-cols-5 gap-2">
                          {stringSamples.map((sample) => {
                            const uniqueKey = `${stringIndex}-${sample.index}`
                            return (
                              <Button
                                key={uniqueKey}
                                variant={
                                  playingSampleIndex === stringIndex * 100 + sample.index
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() =>
                                  handlePlaySample({
                                    ...sample,
                                    index: stringIndex * 100 + sample.index,
                                  })
                                }
                              >
                                {playingSampleIndex === stringIndex * 100 + sample.index ? (
                                  <Pause className="mr-1 size-3" />
                                ) : (
                                  <Play className="mr-1 size-3" />
                                )}
                                {sample.index + 1}
                              </Button>
                            )
                          })}
                        </div>
                      </div>
                    ),
                  )}
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
