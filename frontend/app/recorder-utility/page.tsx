"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Circle, Download, Mic, Play, Square, Trash2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

const SAMPLE_RATE = 44100
const RECORDING_DURATION = 0.75
const SAMPLES_COUNT = Math.floor(SAMPLE_RATE * RECORDING_DURATION)

interface AudioSample {
  id: string
  stringNumber: number
  fretPosition: number
  timestamp: number
  audioData: Float32Array
  duration: number
}

const STRING_NAMES = [
  { number: 1, name: "E4", label: "High E" },
  { number: 2, name: "B3", label: "B" },
  { number: 3, name: "G3", label: "G" },
  { number: 4, name: "D3", label: "D" },
  { number: 5, name: "A2", label: "A" },
  { number: 6, name: "E2", label: "Low E" },
]

const STRING_COLORS = [
  "bg-red-500 hover:bg-red-600",
  "bg-orange-500 hover:bg-orange-600",
  "bg-yellow-500 hover:bg-yellow-600",
  "bg-green-500 hover:bg-green-600",
  "bg-blue-500 hover:bg-blue-600",
  "bg-purple-500 hover:bg-purple-600",
]

function createWavBlob(audioData: Float32Array, sampleRate: number): Blob {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = audioData.length * bytesPerSample
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
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]))
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset, intSample, true)
    offset += 2
  }

  return new Blob([buffer], { type: "audio/wav" })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("AudioSamplesDB", 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains("samples")) {
        const store = db.createObjectStore("samples", { keyPath: "id" })
        store.createIndex("stringNumber", "stringNumber", { unique: false })
      }
    }
  })
}

async function saveSampleToDb(sample: AudioSample): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["samples"], "readwrite")
    const store = transaction.objectStore("samples")
    const serializedSample = {
      ...sample,
      audioData: Array.from(sample.audioData),
    }
    const request = store.put(serializedSample)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

async function loadSamplesFromDb(): Promise<AudioSample[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["samples"], "readonly")
    const store = transaction.objectStore("samples")
    const request = store.getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const samples = request.result.map((s: { audioData: number[] } & Omit<AudioSample, "audioData">) => ({
        ...s,
        audioData: new Float32Array(s.audioData),
      }))
      resolve(samples)
    }
  })
}

async function deleteSampleFromDb(id: string): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["samples"], "readwrite")
    const store = transaction.objectStore("samples")
    const request = store.delete(id)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

async function clearAllSamplesFromDb(): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["samples"], "readwrite")
    const store = transaction.objectStore("samples")
    const request = store.clear()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export default function RecorderUtilityPage() {
  const [samples, setSamples] = useState<AudioSample[]>([])
  const [recording, setRecording] = useState<number | null>(null)
  const [recordingProgress, setRecordingProgress] = useState(0)
  const [fretPosition, setFretPosition] = useState(0)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)

  useEffect(() => {
    loadSamplesFromDb()
      .then(setSamples)
      .catch((err) => {
        console.error("Failed to load samples:", err)
        toast.error("Failed to load saved samples")
      })
  }, [])

  const requestMicrophonePermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      setHasPermission(true)
      toast.success("Microphone access granted")
    } catch {
      setHasPermission(false)
      toast.error("Microphone access denied")
    }
  }, [])

  const startRecording = useCallback(
    async (stringNumber: number) => {
      if (recording !== null) return

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: SAMPLE_RATE,
          },
        })

        streamRef.current = stream
        const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
        audioContextRef.current = audioContext

        const source = audioContext.createMediaStreamSource(stream)
        const collectedSamples: number[] = []
        const startTime = Date.now()

        setRecording(stringNumber)
        setRecordingProgress(0)

        const processor = audioContext.createScriptProcessor(4096, 1, 1)
        processorNodeRef.current = processor

        processor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0)
          const elapsed = (Date.now() - startTime) / 1000
          setRecordingProgress(Math.min(elapsed / RECORDING_DURATION, 1))

          for (let i = 0; i < inputData.length && collectedSamples.length < SAMPLES_COUNT; i++) {
            collectedSamples.push(inputData[i])
          }

          if (collectedSamples.length >= SAMPLES_COUNT) {
            processor.disconnect()
            source.disconnect()
            stream.getTracks().forEach((track) => track.stop())
            audioContext.close()

            const audioData = new Float32Array(collectedSamples.slice(0, SAMPLES_COUNT))
            const newSample: AudioSample = {
              id: `${stringNumber}_${fretPosition}_${Date.now()}`,
              stringNumber,
              fretPosition,
              timestamp: Date.now(),
              audioData,
              duration: RECORDING_DURATION,
            }

            saveSampleToDb(newSample)
              .then(() => {
                setSamples((prev) => [...prev, newSample])
                toast.success(`Recorded string ${stringNumber} sample`)
              })
              .catch((err) => {
                console.error("Failed to save sample:", err)
                toast.error("Failed to save sample")
              })

            setRecording(null)
            setRecordingProgress(0)
          }
        }

        source.connect(processor)
        processor.connect(audioContext.destination)
      } catch (err) {
        console.error("Recording failed:", err)
        toast.error("Failed to start recording")
        setRecording(null)
        setRecordingProgress(0)
      }
    },
    [recording, fretPosition],
  )

  const playSample = useCallback(
    async (sample: AudioSample) => {
      if (playingId === sample.id) return

      try {
        setPlayingId(sample.id)
        const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
        const buffer = audioContext.createBuffer(1, sample.audioData.length, SAMPLE_RATE)
        buffer.getChannelData(0).set(sample.audioData)

        const source = audioContext.createBufferSource()
        source.buffer = buffer
        source.connect(audioContext.destination)

        source.onended = () => {
          setPlayingId(null)
          audioContext.close()
        }

        source.start()
      } catch (err) {
        console.error("Playback failed:", err)
        toast.error("Failed to play sample")
        setPlayingId(null)
      }
    },
    [playingId],
  )

  const deleteSample = useCallback(async (id: string) => {
    try {
      await deleteSampleFromDb(id)
      setSamples((prev) => prev.filter((s) => s.id !== id))
      toast.success("Sample deleted")
    } catch (err) {
      console.error("Failed to delete sample:", err)
      toast.error("Failed to delete sample")
    }
  }, [])

  const clearSamplesForString = useCallback(
    async (stringNumber: number) => {
      const toDelete = samples.filter((s) => s.stringNumber === stringNumber)
      try {
        for (const sample of toDelete) {
          await deleteSampleFromDb(sample.id)
        }
        setSamples((prev) => prev.filter((s) => s.stringNumber !== stringNumber))
        toast.success(`Cleared all samples for string ${stringNumber}`)
      } catch (err) {
        console.error("Failed to clear samples:", err)
        toast.error("Failed to clear samples")
      }
    },
    [samples],
  )

  const clearAllSamples = useCallback(async () => {
    try {
      await clearAllSamplesFromDb()
      setSamples([])
      toast.success("All samples cleared")
    } catch (err) {
      console.error("Failed to clear all samples:", err)
      toast.error("Failed to clear all samples")
    }
  }, [])

  const downloadSample = useCallback((sample: AudioSample) => {
    const blob = createWavBlob(sample.audioData, SAMPLE_RATE)
    const url = URL.createObjectURL(blob)
    const filename = `string${sample.stringNumber}_fret${sample.fretPosition}_${sample.timestamp}.wav`

    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(`Downloaded ${filename}`)
  }, [])

  const downloadAllSamples = useCallback(async () => {
    if (samples.length === 0) {
      toast.error("No samples to download")
      return
    }

    for (const sample of samples) {
      downloadSample(sample)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    toast.success(`Downloaded ${samples.length} samples`)
  }, [samples, downloadSample])

  const getSamplesForString = (stringNumber: number) => samples.filter((s) => s.stringNumber === stringNumber)

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Audio Recording Utility</h1>
        <p className="text-muted-foreground mt-2">Record labeled 0.75-second audio clips for ML training data</p>
      </div>

      {hasPermission === null && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Microphone Access Required</p>
                <p className="text-muted-foreground text-sm">Grant microphone access to start recording</p>
              </div>
              <Button onClick={requestMicrophonePermission}>
                <Mic className="mr-2 size-4" />
                Enable Microphone
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasPermission === false && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">
              Microphone access was denied. Please enable microphone access in your browser settings.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Recording Settings</CardTitle>
          <CardDescription>Configure recording parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <label className="font-medium">Fret Position:</label>
            <Input
              type="number"
              min={0}
              max={24}
              value={fretPosition}
              onChange={(e) => setFretPosition(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))}
              className="w-20"
            />
            <span className="text-muted-foreground text-sm">(0 = open string)</span>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="size-5" />
            Record Samples
          </CardTitle>
          <CardDescription>Click a string button to record a 0.75-second sample</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {STRING_NAMES.map((string, index) => {
              const isRecording = recording === string.number
              const sampleCount = getSamplesForString(string.number).length

              return (
                <Button
                  key={string.number}
                  onClick={() => startRecording(string.number)}
                  disabled={recording !== null && !isRecording}
                  className={`relative h-24 flex-col gap-1 text-white ${isRecording ? "animate-pulse bg-red-600" : STRING_COLORS[index]}`}
                >
                  {isRecording && (
                    <div className="absolute top-2 right-2">
                      <Circle className="size-3 animate-pulse fill-white" />
                    </div>
                  )}
                  <span className="text-lg font-bold">String {string.number}</span>
                  <span className="text-sm opacity-90">
                    {string.name} ({string.label})
                  </span>
                  <Badge variant="secondary" className="mt-1">
                    {sampleCount} samples
                  </Badge>
                  {isRecording && (
                    <div className="absolute right-0 bottom-0 left-0 h-1 bg-white/30">
                      <div className="h-full bg-white transition-all" style={{ width: `${recordingProgress * 100}%` }} />
                    </div>
                  )}
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Recorded Samples ({samples.length})</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadAllSamples} disabled={samples.length === 0}>
                <Download className="mr-2 size-4" />
                Download All
              </Button>
              <Button variant="destructive" size="sm" onClick={clearAllSamples} disabled={samples.length === 0}>
                <Trash2 className="mr-2 size-4" />
                Clear All
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {samples.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No samples recorded yet. Click a string button above to start recording.</p>
          ) : (
            <div className="space-y-6">
              {STRING_NAMES.map((string) => {
                const stringSamples = getSamplesForString(string.number)
                if (stringSamples.length === 0) return null

                return (
                  <div key={string.number}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 font-medium">
                        <span
                          className={`size-3 rounded-full ${STRING_COLORS[string.number - 1].split(" ")[0]}`}
                        />
                        String {string.number} ({string.name})
                        <Badge variant="outline">{stringSamples.length}</Badge>
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => clearSamplesForString(string.number)}>
                        <Trash2 className="mr-1 size-3" />
                        Clear
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      {stringSamples.map((sample) => (
                        <div
                          key={sample.id}
                          className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
                        >
                          <div className="flex items-center gap-4">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => playSample(sample)}
                              disabled={playingId === sample.id}
                            >
                              {playingId === sample.id ? (
                                <Square className="size-4" />
                              ) : (
                                <Play className="size-4" />
                              )}
                            </Button>
                            <div>
                              <p className="text-sm font-medium">
                                Fret {sample.fretPosition} - {formatTime(sample.timestamp)}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {sample.duration.toFixed(2)}s - {sample.audioData.length} samples
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => downloadSample(sample)}>
                              <Download className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => deleteSample(sample.id)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>
              <strong>File Format:</strong> WAV (PCM 16-bit, Mono, {SAMPLE_RATE}Hz)
            </p>
            <p>
              <strong>Duration:</strong> {RECORDING_DURATION} seconds ({SAMPLES_COUNT} samples)
            </p>
            <p>
              <strong>Naming Convention:</strong> string{"{N}"}_fret{"{F}"}_{"{timestamp}"}.wav
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
