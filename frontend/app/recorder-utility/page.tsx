"use client"

import { Fretboard, type Marker } from "@/components/fretboard/fretboard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { STANDARD_TUNING_STRINGS, midiToFreq } from "@/lib/audio/guitar-constants"
import { midiToNoteName } from "@/lib/audio/utils"
import { useCallback, useEffect, useRef, useState } from "react"

type SampleCounts = Record<string, Record<string, number>>

const SAMPLE_COUNT = 5
const RECORDING_DURATION_MS = 750
const SILENCE_WAIT_MS = 200
const COUNTDOWN_SECONDS = 2
const SILENCE_THRESHOLD = 0.01
const PRE_ATTACK_MS = 10

type RecordingState =
  | "idle"
  | "countdown"
  | "waiting-for-pluck"
  | "recording"
  | "waiting-for-silence"
  | "complete"

interface RecordedSample {
  blob: Blob
  url: string
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, "data")
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: "audio/wav" })
}

export default function RecorderUtilityPage() {
  const [selectedString, setSelectedString] = useState<number>(6)
  const [selectedFret, setSelectedFret] = useState<number>(0)
  const [recordingState, setRecordingState] = useState<RecordingState>("idle")
  const [countdown, setCountdown] = useState<number>(COUNTDOWN_SECONDS)
  const [currentSampleIndex, setCurrentSampleIndex] = useState<number>(0)
  const [samples, setSamples] = useState<RecordedSample[]>([])
  const [error, setError] = useState<string | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const recordingBufferRef = useRef<Float32Array[]>([])
  const preBufferRef = useRef<Float32Array[]>([])
  const isRecordingRef = useRef<boolean>(false)
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const sampleUrlsRef = useRef<string[]>([])
  const sampleRateRef = useRef<number>(44100)

  const stringProfile = STANDARD_TUNING_STRINGS.find((s) => s.stringNumber === selectedString)
  const noteMidi = stringProfile ? stringProfile.openMidi + selectedFret : 40
  const noteName = midiToNoteName(noteMidi)
  const noteFreq = midiToFreq(noteMidi)

  const cleanup = useCallback(() => {
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current)
      silenceCheckIntervalRef.current = null
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect()
      scriptProcessorRef.current = null
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect()
      analyserRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      cleanup()
      sampleUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [cleanup])

  const getAudioLevel = useCallback((): number => {
    if (!analyserRef.current) return 0
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteTimeDomainData(dataArray)
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128
      sum += normalized * normalized
    }
    return Math.sqrt(sum / dataArray.length)
  }, [])

  const startRecordingChunk = useCallback(() => {
    recordingBufferRef.current = [...preBufferRef.current]
    preBufferRef.current = []
    isRecordingRef.current = true
  }, [])

  const stopRecordingChunk = useCallback((): RecordedSample | null => {
    isRecordingRef.current = false
    if (recordingBufferRef.current.length === 0) return null

    const totalLength = recordingBufferRef.current.reduce((acc, chunk) => acc + chunk.length, 0)
    const combined = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of recordingBufferRef.current) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    const blob = encodeWav(combined, sampleRateRef.current)
    const url = URL.createObjectURL(blob)
    sampleUrlsRef.current.push(url)
    return { blob, url }
  }, [])

  const waitForSilence = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const check = () => {
        const level = getAudioLevel()
        if (level < SILENCE_THRESHOLD) {
          if (silenceCheckIntervalRef.current) {
            clearInterval(silenceCheckIntervalRef.current)
            silenceCheckIntervalRef.current = null
          }
          setTimeout(resolve, SILENCE_WAIT_MS)
        }
      }
      silenceCheckIntervalRef.current = setInterval(check, 50)
    })
  }, [getAudioLevel])

  const waitForPluck = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const check = () => {
        const level = getAudioLevel()
        if (level > SILENCE_THRESHOLD * 2) {
          if (silenceCheckIntervalRef.current) {
            clearInterval(silenceCheckIntervalRef.current)
            silenceCheckIntervalRef.current = null
          }
          resolve()
        }
      }
      silenceCheckIntervalRef.current = setInterval(check, 10)
    })
  }, [getAudioLevel])

  const recordSingleSample = useCallback(async (): Promise<RecordedSample | null> => {
    setRecordingState("waiting-for-pluck")
    await waitForPluck()

    setRecordingState("recording")
    startRecordingChunk()
    await new Promise((resolve) => setTimeout(resolve, RECORDING_DURATION_MS))
    const sample = stopRecordingChunk()

    setRecordingState("waiting-for-silence")
    await waitForSilence()

    return sample
  }, [waitForPluck, startRecordingChunk, stopRecordingChunk, waitForSilence])

  const startRecording = useCallback(async () => {
    setError(null)
    sampleUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    sampleUrlsRef.current = []
    setSamples([])
    setCurrentSampleIndex(0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      mediaStreamRef.current = stream

      const audioContext = new AudioContext()
      sampleRateRef.current = audioContext.sampleRate
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser
      source.connect(analyser)

      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)
      const preBufferSamples = Math.ceil((PRE_ATTACK_MS / 1000) * audioContext.sampleRate)
      const preBufferChunks = Math.ceil(preBufferSamples / 4096)

      scriptProcessor.onaudioprocess = (event) => {
        const inputData = new Float32Array(event.inputBuffer.getChannelData(0))

        if (isRecordingRef.current) {
          recordingBufferRef.current.push(inputData)
        } else {
          preBufferRef.current.push(inputData)
          if (preBufferRef.current.length > preBufferChunks) {
            preBufferRef.current.shift()
          }
        }
      }
      scriptProcessorRef.current = scriptProcessor
      source.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)

      setRecordingState("countdown")
      for (let i = COUNTDOWN_SECONDS; i > 0; i--) {
        setCountdown(i)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      const recordedSamples: RecordedSample[] = []
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        setCurrentSampleIndex(i)
        const sample = await recordSingleSample()
        if (sample) {
          recordedSamples.push(sample)
          setSamples([...recordedSamples])
        }
      }

      setRecordingState("complete")
      cleanup()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to access microphone")
      setRecordingState("idle")
      cleanup()
    }
  }, [recordSingleSample, cleanup])

  const resetRecording = useCallback(() => {
    sampleUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    sampleUrlsRef.current = []
    setSamples([])
    setCurrentSampleIndex(0)
    setRecordingState("idle")
    setError(null)
  }, [])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sampleCounts, setSampleCounts] = useState<SampleCounts>({})

  const fetchSampleCounts = useCallback(async () => {
    try {
      const response = await fetch("/recorder-utility/get")
      const data = await response.json()
      if (data.counts) {
        setSampleCounts(data.counts)
      }
    } catch (err) {
      console.error("Failed to fetch sample counts:", err)
    }
  }, [])

  useEffect(() => {
    fetchSampleCounts()
  }, [fetchSampleCounts])

  const handleSubmit = useCallback(async () => {
    if (samples.length === 0 || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("string", selectedString.toString())
      formData.append("fret", selectedFret.toString())

      samples.forEach((sample, index) => {
        formData.append(`sample_${index}`, sample.blob, `sample_${index}.wav`)
      })

      const response = await fetch("/recorder-utility/post", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit samples")
      }

      resetRecording()
      fetchSampleCounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit samples")
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedString, selectedFret, samples, isSubmitting, resetRecording])

  const sampleCountMarkers: Marker[] = Object.entries(sampleCounts).flatMap(([stringNum, frets]) =>
    Object.entries(frets).map(([fretNum, count]) => ({
      stringIndex: 6 - parseInt(stringNum, 10),
      fretIndex: parseInt(fretNum, 10),
      type: "note" as const,
      label: count.toString(),
    })),
  )

  const getStatusMessage = () => {
    switch (recordingState) {
      case "idle":
        return "Select a string and fret, then press Start"
      case "countdown":
        return `Starting in ${countdown}...`
      case "waiting-for-pluck":
        return "🎸 Pluck the string now!"
      case "recording":
        return "🔴 Recording..."
      case "waiting-for-silence":
        return "✋ Mute the string"
      case "complete":
        return "✅ Recording complete! Review your samples below."
      default:
        return ""
    }
  }

  return (
    <div className="max-w-8xl container mx-auto grid grid-cols-2 gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Sample Recorder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium">String</label>
              <Select
                value={selectedString.toString()}
                onValueChange={(v) => setSelectedString(parseInt(v))}
                disabled={recordingState !== "idle" && recordingState !== "complete"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STANDARD_TUNING_STRINGS.map((s) => (
                    <SelectItem key={s.stringNumber} value={s.stringNumber.toString()}>
                      {s.stringNumber} - {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium">Fret</label>
              <Select
                value={selectedFret.toString()}
                onValueChange={(v) => setSelectedFret(parseInt(v))}
                disabled={recordingState !== "idle" && recordingState !== "complete"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 25 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i === 0 ? "Open" : `Fret ${i}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 py-4">
            <Badge variant="secondary" className="px-4 py-2 text-2xl">
              {noteName}
            </Badge>
            <span className="text-muted-foreground text-sm">{noteFreq.toFixed(2)} Hz</span>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
          )}

          <div className="py-4 text-center">
            <p className="text-lg font-medium">{getStatusMessage()}</p>
            {recordingState !== "idle" && recordingState !== "complete" && (
              <p className="text-muted-foreground mt-2">
                Sample {currentSampleIndex + 1} of {SAMPLE_COUNT}
              </p>
            )}
          </div>

          <div className="flex justify-center gap-4">
            {recordingState === "idle" && (
              <Button size="lg" onClick={startRecording}>
                Start Recording
              </Button>
            )}
            {recordingState === "complete" && (
              <>
                <Button variant="outline" onClick={resetRecording}>
                  Record Again
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Samples"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recorded Samples</CardTitle>
        </CardHeader>
        <CardContent>
          {samples.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-medium">Recorded Samples</h3>
              <div className="grid gap-2">
                {samples.map((sample, index) => (
                  <div key={index} className="bg-muted/50 flex items-center gap-3 rounded-md p-2">
                    <Badge variant="outline" className="w-8 justify-center">
                      {index + 1}
                    </Badge>
                    <audio controls src={sample.url} className="h-8 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Saved Samples</CardTitle>
        </CardHeader>
        <CardContent>
          <Fretboard markers={sampleCountMarkers} />
        </CardContent>
      </Card>
    </div>
  )
}
