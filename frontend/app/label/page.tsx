"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { STRING_COLORS, WaveformEditor, type NoteInterval } from "@/components/waveform-editor"
import { detectOnsets, onsetsToIntervals } from "@/lib/audio/onset-detection"
import { createWavBlob } from "@/lib/audio/wav"
import { cn } from "@/lib/utils"
import { Loader2, Mic, Play, Plus, Save, Square, Trash2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

const STRING_NAMES = ["E", "A", "D", "G", "B", "e"]

type LabelPhase = "setup" | "countdown" | "recording" | "labeling"

export default function LabelPage() {
  const [phase, setPhase] = useState<LabelPhase>("setup")

  const [durationSeconds, setDurationSeconds] = useState(10)
  const [countdownRemaining, setCountdownRemaining] = useState(3)

  const [recordingTimeMs, setRecordingTimeMs] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [audioData, setAudioData] = useState<Float32Array | null>(null)
  const [sampleRate, setSampleRate] = useState(48000)
  const [intervals, setIntervals] = useState<NoteInterval[]>([])
  const [selectedIntervalId, setSelectedIntervalId] = useState<string | null>(null)
  const [onsetThreshold, setOnsetThreshold] = useState(0.1)
  const [playbackPositionMs, setPlaybackPositionMs] = useState<number | null>(null)
  const [cursorPositionMs, setCursorPositionMs] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [cropStartMs, setCropStartMs] = useState(0)
  const [cropEndMs, setCropEndMs] = useState(0)

  const [isAddingInterval, setIsAddingInterval] = useState(false)
  const [showRedetectDialog, setShowRedetectDialog] = useState(false)
  const pendingThresholdRef = useRef(0.3)

  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const animationFrameRef = useRef<number>(0)
  const playbackStartTimeRef = useRef(0)
  const playbackOffsetRef = useRef(0)

  const totalDurationMs = audioData ? (audioData.length / sampleRate) * 1000 : 0

  const stopPlayback = useCallback(() => {
    if (audioContextRef.current) {
      const elapsed = (audioContextRef.current.currentTime - playbackStartTimeRef.current) * 1000
      setCursorPositionMs(playbackOffsetRef.current + elapsed)
    }
    try {
      sourceNodeRef.current?.stop()
    } catch {
      // already stopped
    }
    sourceNodeRef.current?.disconnect()
    cancelAnimationFrame(animationFrameRef.current)
    audioContextRef.current?.close()
    audioContextRef.current = null
    sourceNodeRef.current = null
    setPlaybackPositionMs(null)
  }, [])

  useEffect(() => {
    return () => {
      stopPlayback()
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [stopPlayback])

  const playAudioRange = useCallback(
    (startMs: number, endMs: number) => {
      if (!audioData) return
      stopPlayback()

      const ctx = new AudioContext()
      audioContextRef.current = ctx

      const buffer = ctx.createBuffer(1, audioData.length, sampleRate)
      buffer.getChannelData(0).set(audioData)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      sourceNodeRef.current = source

      playbackOffsetRef.current = startMs
      playbackStartTimeRef.current = ctx.currentTime

      const startSec = startMs / 1000
      const durationSec = (endMs - startMs) / 1000

      source.start(0, startSec, durationSec)
      source.onended = () => {
        setPlaybackPositionMs(null)
        cancelAnimationFrame(animationFrameRef.current)
      }

      const animate = () => {
        if (!audioContextRef.current) return
        const elapsed = (audioContextRef.current.currentTime - playbackStartTimeRef.current) * 1000
        const currentMs = playbackOffsetRef.current + elapsed
        if (currentMs <= endMs) {
          setPlaybackPositionMs(currentMs)
          animationFrameRef.current = requestAnimationFrame(animate)
        } else {
          setPlaybackPositionMs(null)
          setCursorPositionMs(endMs)
        }
      }
      animationFrameRef.current = requestAnimationFrame(animate)
    },
    [audioData, sampleRate, stopPlayback],
  )

  const runOnsetDetection = useCallback(
    (threshold: number) => {
      if (!audioData) return
      const onsets = detectOnsets(audioData, sampleRate, { threshold })
      const durationMs = (audioData.length / sampleRate) * 1000
      const raw = onsetsToIntervals(onsets, durationMs)
      const noteIntervals: NoteInterval[] = raw.map((interval) => ({
        id: crypto.randomUUID(),
        startMs: interval.startMs,
        endMs: interval.endMs,
        string: null,
      }))
      setIntervals(noteIntervals)
      setSelectedIntervalId(null)
    },
    [audioData, sampleRate],
  )

  const processRecordedAudio = useCallback(
    async (blob: Blob) => {
      const audioCtx = new AudioContext()
      const arrayBuffer = await blob.arrayBuffer()
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

      const channelData = audioBuffer.getChannelData(0)
      const sr = audioBuffer.sampleRate

      setAudioData(channelData)
      setSampleRate(sr)

      const durationMs = (channelData.length / sr) * 1000
      setCropStartMs(0)
      setCropEndMs(durationMs)

      const onsets = detectOnsets(channelData, sr, {
        threshold: onsetThreshold,
      })
      const raw = onsetsToIntervals(onsets, durationMs)
      const noteIntervals: NoteInterval[] = raw.map((interval) => ({
        id: crypto.randomUUID(),
        startMs: interval.startMs,
        endMs: interval.endMs,
        string: null,
      }))

      setIntervals(noteIntervals)
      setPhase("labeling")
      await audioCtx.close()
    },
    [onsetThreshold],
  )

  const startRecording = useCallback(async () => {
    setPhase("recording")
    setRecordingTimeMs(0)
    chunksRef.current = []

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm"

    const mediaRecorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunksRef.current, { type: mimeType })
      await processRecordedAudio(blob)
    }

    mediaRecorder.start(100)

    const startTime = Date.now()
    timerIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      setRecordingTimeMs(elapsed)
      if (elapsed >= durationSeconds * 1000) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
        mediaRecorder.stop()
      }
    }, 50)
  }, [durationSeconds, processRecordedAudio])

  const handleStartRecording = useCallback(() => {
    setCountdownRemaining(3)
    setPhase("countdown")

    let remaining = 3
    const countdownInterval = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearInterval(countdownInterval)
        startRecording()
      } else {
        setCountdownRemaining(remaining)
      }
    }, 1000)

    timerIntervalRef.current = countdownInterval
  }, [startRecording])

  const handleStopEarly = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    mediaRecorderRef.current?.stop()
  }, [])

  const handleCropChange = useCallback((startMs: number, endMs: number) => {
    setCropStartMs(startMs)
    setCropEndMs(endMs)
  }, [])

  const handleThresholdChange = useCallback(
    ([value]: number[]) => {
      const hasLabels = intervals.some((i) => i.string !== null)
      if (hasLabels) {
        pendingThresholdRef.current = value
        setShowRedetectDialog(true)
        return
      }
      setOnsetThreshold(value)
      runOnsetDetection(value)
    },
    [intervals, runOnsetDetection],
  )

  const handleConfirmRedetect = useCallback(() => {
    const value = pendingThresholdRef.current
    setOnsetThreshold(value)
    runOnsetDetection(value)
    setShowRedetectDialog(false)
  }, [runOnsetDetection])

  const handleSetString = useCallback((intervalId: string, stringIndex: number) => {
    setIntervals((prev) =>
      prev.map((i) =>
        i.id === intervalId ? { ...i, string: i.string === stringIndex ? null : stringIndex } : i,
      ),
    )
  }, [])

  const handleSetAllStrings = useCallback((stringIndex: number) => {
    setIntervals((prev) => prev.map((i) => ({ ...i, string: stringIndex })))
  }, [])

  const handleDeleteInterval = useCallback(
    (id: string) => {
      setIntervals((prev) => prev.filter((i) => i.id !== id))
      if (selectedIntervalId === id) setSelectedIntervalId(null)
    },
    [selectedIntervalId],
  )

  const handleGapClick = useCallback((startMs: number, endMs: number) => {
    const newInterval: NoteInterval = {
      id: crypto.randomUUID(),
      startMs,
      endMs,
      string: null,
    }
    setIntervals((prev) => [...prev, newInterval].sort((a, b) => a.startMs - b.startMs))
    setSelectedIntervalId(newInterval.id)
    setIsAddingInterval(false)
  }, [])

  const handleSeek = useCallback(
    (ms: number) => {
      if (playbackPositionMs !== null) {
        stopPlayback()
      }
      setCursorPositionMs(ms)
    },
    [playbackPositionMs, stopPlayback],
  )

  const handlePlayAll = useCallback(() => {
    if (!audioData) return
    playAudioRange(cursorPositionMs ?? 0, totalDurationMs)
  }, [audioData, cursorPositionMs, totalDurationMs, playAudioRange])

  const handlePlaySelected = useCallback(() => {
    const interval = intervals.find((i) => i.id === selectedIntervalId)
    if (!interval) return
    playAudioRange(interval.startMs, interval.endMs)
  }, [intervals, selectedIntervalId, playAudioRange])

  const handleSave = useCallback(async () => {
    if (!audioData) return
    setIsSaving(true)

    try {
      const cropStartSample = Math.floor((cropStartMs / 1000) * sampleRate)
      const cropEndSample = Math.floor((cropEndMs / 1000) * sampleRate)
      const croppedAudio = audioData.slice(cropStartSample, cropEndSample)
      const wavBlob = createWavBlob(croppedAudio, sampleRate)

      const croppedDurationMs = cropEndMs - cropStartMs
      const labels = {
        sampleRate,
        durationMs: croppedDurationMs,
        intervals: intervals
          .filter((i) => i.string !== null && i.startMs >= cropStartMs && i.endMs <= cropEndMs)
          .map(({ id: _id, ...rest }) => ({
            ...rest,
            startMs: rest.startMs - cropStartMs,
            endMs: rest.endMs - cropStartMs,
          })),
      }

      const formData = new FormData()
      formData.append("audio", wavBlob, "audio.wav")
      formData.append("labels", JSON.stringify(labels))

      const response = await fetch("/label/save", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) throw new Error("Failed to save")

      setPhase("setup")
      setAudioData(null)
      setIntervals([])
      setSelectedIntervalId(null)
    } catch (err) {
      console.error("Failed to save labeling session:", err)
    } finally {
      setIsSaving(false)
    }
  }, [audioData, sampleRate, intervals, cropStartMs, cropEndMs])

  const canSave = intervals.length > 0 && intervals.some((i) => i.string !== null)

  useEffect(() => {
    if (phase !== "labeling") return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return

      switch (e.key) {
        case " ":
          e.preventDefault()
          if (playbackPositionMs !== null) {
            stopPlayback()
          } else {
            handlePlayAll()
          }
          break
        case "Enter":
          e.preventDefault()
          handlePlaySelected()
          break
        case "Delete":
        case "Backspace":
          if (selectedIntervalId) {
            e.preventDefault()
            handleDeleteInterval(selectedIntervalId)
          }
          break
        case "Escape":
          if (isAddingInterval) {
            e.preventDefault()
            setIsAddingInterval(false)
          }
          break
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6": {
          const stringIndex = parseInt(e.key) - 1
          if (playbackPositionMs !== null) {
            const intervalAtCursor = intervals.find(
              (i) => playbackPositionMs >= i.startMs && playbackPositionMs <= i.endMs,
            )
            if (intervalAtCursor) {
              handleSetString(intervalAtCursor.id, stringIndex)
            }
          } else if (selectedIntervalId) {
            handleSetString(selectedIntervalId, stringIndex)
          }
          break
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    phase,
    playbackPositionMs,
    selectedIntervalId,
    isAddingInterval,
    stopPlayback,
    handlePlayAll,
    handlePlaySelected,
    intervals,
    handleDeleteInterval,
    handleSetString,
  ])

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold">Tap Labeling</h1>

        {phase === "setup" && (
          <Card>
            <CardHeader>
              <CardTitle>New Labeling Session</CardTitle>
              <CardDescription>
                Record yourself playing a sequence of notes, then label each note with its string.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Recording Duration: {durationSeconds}s
                </label>
                <Slider
                  value={[durationSeconds]}
                  onValueChange={([v]) => setDurationSeconds(v)}
                  min={5}
                  max={30}
                  step={1}
                />
              </div>
              <Button onClick={handleStartRecording} size="lg">
                <Mic className="mr-2 size-4" />
                Start Recording
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "countdown" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <p className="text-muted-foreground text-sm">Get ready...</p>
              <div className="text-7xl font-bold tabular-nums">{countdownRemaining}</div>
              <Button
                variant="outline"
                onClick={() => {
                  if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
                  setPhase("setup")
                }}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "recording" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="relative flex size-16 items-center justify-center">
                <div className="bg-destructive absolute inset-0 animate-ping rounded-full opacity-25" />
                <div className="bg-destructive flex size-12 items-center justify-center rounded-full">
                  <Mic className="size-6 text-white" />
                </div>
              </div>
              <p className="text-muted-foreground text-lg tabular-nums">
                {(recordingTimeMs / 1000).toFixed(1)}s / {durationSeconds}.0s
              </p>
              <div className="bg-muted h-2 w-full max-w-md overflow-hidden rounded-full">
                <div
                  className="bg-destructive h-full transition-all"
                  style={{
                    width: `${Math.min((recordingTimeMs / (durationSeconds * 1000)) * 100, 100)}%`,
                  }}
                />
              </div>
              <Button variant="outline" onClick={handleStopEarly}>
                <Square className="mr-2 size-4" />
                Stop Early
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {phase === "labeling" && audioData && (
        <>
          <div className="mx-auto my-6 max-w-[1600px]">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <WaveformEditor
                  audioData={audioData}
                  sampleRate={sampleRate}
                  intervals={intervals}
                  selectedIntervalId={selectedIntervalId}
                  playbackPositionMs={playbackPositionMs ?? cursorPositionMs}
                  cropStartMs={cropStartMs}
                  cropEndMs={cropEndMs}
                  isAddingInterval={isAddingInterval}
                  onIntervalsChange={setIntervals}
                  onIntervalSelect={setSelectedIntervalId}
                  onCropChange={handleCropChange}
                  onGapClick={handleGapClick}
                  onSeek={handleSeek}
                />

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={playbackPositionMs !== null ? stopPlayback : handlePlayAll}
                    >
                      {playbackPositionMs !== null ? (
                        <Square className="mr-1 size-3" />
                      ) : (
                        <Play className="mr-1 size-3" />
                      )}
                      {playbackPositionMs !== null ? "Stop" : "Play All"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePlaySelected}
                      disabled={!selectedIntervalId}
                    >
                      <Play className="mr-1 size-3" />
                      Play Selected
                    </Button>
                  </div>

                  <div className="flex flex-1 items-center gap-2">
                    <span className="text-muted-foreground shrink-0 text-sm">
                      Onset Sensitivity
                    </span>
                    <Slider
                      value={[onsetThreshold]}
                      onValueChange={handleThresholdChange}
                      min={0.05}
                      max={0.8}
                      step={0.05}
                      className="max-w-48"
                    />
                    <span className="text-muted-foreground w-10 text-sm tabular-nums">
                      {onsetThreshold.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="mx-auto max-w-4xl">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Intervals ({intervals.length})</CardTitle>
                <CardDescription>
                  Click timeline to seek. Space to play/stop. 1-6 to label (selected or under cursor
                  during playback). Enter to play selected. Delete to remove.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">Set all to:</span>
                  {STRING_NAMES.map((name, stringIndex) => (
                    <button
                      key={stringIndex}
                      className="flex size-7 items-center justify-center rounded text-xs font-medium transition-colors"
                      style={{ backgroundColor: STRING_COLORS[stringIndex], color: "white" }}
                      onClick={() => handleSetAllStrings(stringIndex)}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                <div className="max-h-80 space-y-1 overflow-y-auto">
                  {intervals.map((interval, index) => (
                    <div
                      key={interval.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                        selectedIntervalId === interval.id
                          ? "border-primary bg-accent"
                          : "hover:bg-accent/50",
                      )}
                      onClick={() => setSelectedIntervalId(interval.id)}
                    >
                      <span className="text-muted-foreground w-8 text-sm">#{index + 1}</span>
                      <span className="w-32 text-sm tabular-nums">
                        {(interval.startMs / 1000).toFixed(2)}s &ndash;{" "}
                        {(interval.endMs / 1000).toFixed(2)}s
                      </span>

                      <div className="flex gap-1">
                        {STRING_NAMES.map((name, stringIndex) => (
                          <button
                            key={stringIndex}
                            className={cn(
                              "flex size-7 items-center justify-center rounded text-xs font-medium transition-colors",
                              interval.string === stringIndex
                                ? "text-white"
                                : "bg-muted hover:bg-muted-foreground/20",
                            )}
                            style={
                              interval.string === stringIndex
                                ? {
                                    backgroundColor: STRING_COLORS[stringIndex],
                                  }
                                : undefined
                            }
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSetString(interval.id, stringIndex)
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          playAudioRange(interval.startMs, interval.endMs)
                        }}
                      >
                        <Play className="size-3" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteInterval(interval.id)
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant={isAddingInterval ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsAddingInterval((v) => !v)}
                  >
                    <Plus className="mr-1 size-3" />
                    {isAddingInterval ? "Click a gap..." : "Add Interval"}
                  </Button>
                  <div className="flex-1" />
                  <Button size="sm" onClick={handleSave} disabled={!canSave || isSaving}>
                    {isSaving ? (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    ) : (
                      <Save className="mr-1 size-3" />
                    )}
                    Save Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <AlertDialog open={showRedetectDialog} onOpenChange={setShowRedetectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-run onset detection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all current intervals and clear your string labels.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRedetect}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
