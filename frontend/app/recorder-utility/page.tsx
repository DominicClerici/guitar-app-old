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
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { STANDARD_TUNING_STRINGS, midiToFreq } from "@/lib/audio/guitar-constants"
import { KNNClassifier, type KNNModelData } from "@/lib/audio/knn-classifier"
import { extractMultiWindowFeatures } from "@/lib/audio/spectral-features"
import { midiToNoteName } from "@/lib/audio/utils"
import { useCallback, useEffect, useRef, useState } from "react"

type SampleCounts = Record<string, Record<string, number>>
type RecordingMode = "audio" | "training"

const SAMPLE_COUNT = 5
const TRAINING_SAMPLES_PER_FRET = 6
const TRAINING_FRETS = [0, 3, 5, 7, 9, 12]
const RECORDING_DURATION_MS = 750
const SILENCE_WAIT_MS = 200
const COUNTDOWN_SECONDS = 2
const FRET_TRANSITION_SECONDS = 3
const SILENCE_THRESHOLD = 0.005
const PRE_ATTACK_MS = 10
const FFT_SIZE = 4096

type RecordingState =
  | "idle"
  | "countdown"
  | "waiting-for-pluck"
  | "recording"
  | "waiting-for-silence"
  | "fret-transition"
  | "complete"

interface RecordedSample {
  blob: Blob
  url: string
}

interface TrainingSample {
  features: number[]
  stringNumber: number
  fret: number
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
  const [mode, setMode] = useState<RecordingMode>("training")
  const [autoFretProgression, setAutoFretProgression] = useState<boolean>(true)
  const [selectedString, setSelectedString] = useState<number>(6)
  const [selectedFret, setSelectedFret] = useState<number>(0)
  const [recordingState, setRecordingState] = useState<RecordingState>("idle")
  const [countdown, setCountdown] = useState<number>(COUNTDOWN_SECONDS)
  const [currentSampleIndex, setCurrentSampleIndex] = useState<number>(0)
  const [currentTrainingFretIndex, setCurrentTrainingFretIndex] = useState<number>(0)
  const [transitionCountdown, setTransitionCountdown] = useState<number>(FRET_TRANSITION_SECONDS)
  const [samples, setSamples] = useState<RecordedSample[]>([])
  const [trainingSamples, setTrainingSamples] = useState<TrainingSample[]>([])
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

  const classifierRef = useRef<KNNClassifier>(new KNNClassifier(5))
  const [modelStats, setModelStats] = useState({
    totalSamples: 0,
    samplesPerString: new Map<number, number>(),
  })

  const stringProfile = STANDARD_TUNING_STRINGS.find((s) => s.stringNumber === selectedString)
  const currentFret = mode === "training" ? TRAINING_FRETS[currentTrainingFretIndex] : selectedFret
  const noteMidi = stringProfile ? stringProfile.openMidi + currentFret : 40
  const noteName = midiToNoteName(noteMidi)
  const noteFreq = midiToFreq(noteMidi)

  useEffect(() => {
    const loaded = classifierRef.current.loadFromStorage()
    if (loaded) {
      updateModelStats()
    }
  }, [])

  const updateModelStats = useCallback(() => {
    setModelStats({
      totalSamples: classifierRef.current.getSampleCount(),
      samplesPerString: classifierRef.current.getSampleCountByClass(),
    })
  }, [])

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

  const stopRecordingChunk = useCallback((): {
    sample: RecordedSample | null
    rawData: Float32Array | null
  } => {
    isRecordingRef.current = false
    if (recordingBufferRef.current.length === 0) return { sample: null, rawData: null }

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
    return { sample: { blob, url }, rawData: combined }
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

  const recordSingleSample = useCallback(async (fretForSample: number, freqForSample: number): Promise<{
    sample: RecordedSample | null
    training: TrainingSample | null
  }> => {
    setRecordingState("waiting-for-pluck")
    await waitForPluck()

    setRecordingState("recording")
    startRecordingChunk()
    await new Promise((resolve) => setTimeout(resolve, RECORDING_DURATION_MS))
    const { sample, rawData } = stopRecordingChunk()

    setRecordingState("waiting-for-silence")
    await waitForSilence()

    let training: TrainingSample | null = null
    if (mode === "training" && rawData && rawData.length >= FFT_SIZE) {
      const features = extractMultiWindowFeatures(
        rawData,
        freqForSample,
        sampleRateRef.current,
        FFT_SIZE
      )

      training = {
        features,
        stringNumber: selectedString,
        fret: fretForSample,
      }
    }

    return { sample, training }
  }, [
    waitForPluck,
    startRecordingChunk,
    stopRecordingChunk,
    waitForSilence,
    mode,
    selectedString,
  ])

  const startRecording = useCallback(async () => {
    setError(null)
    sampleUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    sampleUrlsRef.current = []
    setSamples([])
    setTrainingSamples([])
    setCurrentSampleIndex(0)
    setCurrentTrainingFretIndex(0)

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
      const recordedTraining: TrainingSample[] = []

      if (mode === "training" && autoFretProgression) {
        for (let fretIdx = 0; fretIdx < TRAINING_FRETS.length; fretIdx++) {
          const fret = TRAINING_FRETS[fretIdx]
          setCurrentTrainingFretIndex(fretIdx)

          const fretMidi = stringProfile ? stringProfile.openMidi + fret : 40
          const fretFreq = midiToFreq(fretMidi)

          for (let i = 0; i < TRAINING_SAMPLES_PER_FRET; i++) {
            setCurrentSampleIndex(i)
            const { sample, training } = await recordSingleSample(fret, fretFreq)
            if (sample) {
              recordedSamples.push(sample)
              setSamples([...recordedSamples])
            }
            if (training) {
              recordedTraining.push(training)
              setTrainingSamples([...recordedTraining])
            }
          }

          if (fretIdx < TRAINING_FRETS.length - 1) {
            setRecordingState("fret-transition")
            for (let t = FRET_TRANSITION_SECONDS; t > 0; t--) {
              setTransitionCountdown(t)
              await new Promise((resolve) => setTimeout(resolve, 1000))
            }
          }
        }
      } else {
        for (let i = 0; i < SAMPLE_COUNT; i++) {
          setCurrentSampleIndex(i)
          const { sample, training } = await recordSingleSample(selectedFret, noteFreq)
          if (sample) {
            recordedSamples.push(sample)
            setSamples([...recordedSamples])
          }
          if (training) {
            recordedTraining.push(training)
            setTrainingSamples([...recordedTraining])
          }
        }
      }

      setRecordingState("complete")
      cleanup()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to access microphone")
      setRecordingState("idle")
      cleanup()
    }
  }, [recordSingleSample, cleanup, mode, autoFretProgression, stringProfile, selectedFret, noteFreq])

  const resetRecording = useCallback(() => {
    sampleUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    sampleUrlsRef.current = []
    setSamples([])
    setTrainingSamples([])
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

  const handleSubmitAudio = useCallback(async () => {
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
  }, [selectedString, selectedFret, samples, isSubmitting, resetRecording, fetchSampleCounts])

  const handleSubmitTraining = useCallback(() => {
    if (trainingSamples.length === 0) return

    for (const sample of trainingSamples) {
      classifierRef.current.addSample(sample.features, sample.stringNumber, {
        fret: sample.fret,
      })
    }

    classifierRef.current.train()
    classifierRef.current.saveToStorage()
    updateModelStats()
    resetRecording()
  }, [trainingSamples, updateModelStats, resetRecording])

  const handleExportModel = useCallback(() => {
    const modelData = classifierRef.current.exportModel()
    const json = JSON.stringify(modelData, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "string-detection-model.json"
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleImportModel = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const modelData: KNNModelData = JSON.parse(text)
        classifierRef.current.importModel(modelData)
        classifierRef.current.saveToStorage()
        updateModelStats()
      } catch (err) {
        setError("Failed to import model")
      }
    }
    input.click()
  }, [updateModelStats])

  const handleClearModel = useCallback(() => {
    classifierRef.current.clearSamples()
    KNNClassifier.clearStorage()
    updateModelStats()
  }, [updateModelStats])

  const handleCrossValidate = useCallback(() => {
    try {
      const result = classifierRef.current.crossValidate(5)
      alert(`Cross-validation accuracy: ${(result.accuracy * 100).toFixed(1)}%`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cross-validation failed")
    }
  }, [])

  const sampleCountMarkers: Marker[] = Object.entries(sampleCounts).flatMap(([stringNum, frets]) =>
    Object.entries(frets).map(([fretNum, count]) => ({
      stringIndex: 6 - parseInt(stringNum, 10),
      fretIndex: parseInt(fretNum, 10),
      type: "note" as const,
      label: count.toString(),
    })),
  )

  const trainingMarkers: Marker[] = STANDARD_TUNING_STRINGS.flatMap((s) => {
    const count = modelStats.samplesPerString.get(s.stringNumber) ?? 0
    if (count === 0) return []
    return [
      {
        stringIndex: 6 - s.stringNumber,
        fretIndex: 0,
        type: "note" as const,
        label: count.toString(),
      },
    ]
  })

  const getStatusMessage = () => {
    switch (recordingState) {
      case "idle":
        return mode === "training" && autoFretProgression
          ? "Select a string, then press Start"
          : "Select a string and fret, then press Start"
      case "countdown":
        return `Starting in ${countdown}...`
      case "waiting-for-pluck":
        return "Pluck the string now!"
      case "recording":
        return "Recording..."
      case "waiting-for-silence":
        return "Mute the string"
      case "fret-transition": {
        const nextFret = TRAINING_FRETS[currentTrainingFretIndex + 1]
        return `Move to fret ${nextFret === 0 ? "Open" : nextFret} in ${transitionCountdown}...`
      }
      case "complete":
        return "Recording complete! Review your samples below."
      default:
        return ""
    }
  }

  return (
    <div className="max-w-8xl container mx-auto grid grid-cols-2 gap-4 p-6">
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sample Recorder</span>
            <Tabs value={mode} onValueChange={(v) => setMode(v as RecordingMode)}>
              <TabsList>
                <TabsTrigger value="training">ML Training</TabsTrigger>
                <TabsTrigger value="audio">Audio Files</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardTitle>
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
            {(mode === "audio" || !autoFretProgression) && (
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
            )}
          </div>

          {mode === "training" && (
            <div className="flex items-center gap-3">
              <Switch
                id="auto-fret"
                checked={autoFretProgression}
                onCheckedChange={setAutoFretProgression}
                disabled={recordingState !== "idle" && recordingState !== "complete"}
              />
              <label htmlFor="auto-fret" className="text-sm">
                Auto fret progression (records at frets {TRAINING_FRETS.join(", ")})
              </label>
            </div>
          )}

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
            {recordingState !== "idle" && recordingState !== "complete" && recordingState !== "fret-transition" && (
              <p className="text-muted-foreground mt-2">
                {mode === "training" && autoFretProgression ? (
                  <>
                    Fret {TRAINING_FRETS[currentTrainingFretIndex] === 0 ? "Open" : TRAINING_FRETS[currentTrainingFretIndex]} - Sample {currentSampleIndex + 1} of {TRAINING_SAMPLES_PER_FRET}
                    <span className="ml-2 text-xs">
                      ({currentTrainingFretIndex + 1}/{TRAINING_FRETS.length} positions)
                    </span>
                  </>
                ) : (
                  <>Sample {currentSampleIndex + 1} of {SAMPLE_COUNT}</>
                )}
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
                {mode === "audio" ? (
                  <Button onClick={handleSubmitAudio} disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Audio Files"}
                  </Button>
                ) : (
                  <Button onClick={handleSubmitTraining} disabled={trainingSamples.length === 0}>
                    Add to Training Model ({trainingSamples.length} samples)
                  </Button>
                )}
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
          {samples.length > 0 ? (
            <div className="space-y-3">
              <div className="grid gap-2">
                {samples.map((sample, index) => (
                  <div key={index} className="bg-muted/50 flex items-center gap-3 rounded-md p-2">
                    <Badge variant="outline" className="w-8 justify-center">
                      {index + 1}
                    </Badge>
                    <audio controls src={sample.url} className="h-8 flex-1" />
                    {mode === "training" && trainingSamples[index] && (
                      <Badge variant="secondary" className="text-xs">
                        Features extracted
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center">No samples recorded yet</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ML Model Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Total: {modelStats.totalSamples} samples</Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {STANDARD_TUNING_STRINGS.map((s) => (
              <Badge
                key={s.stringNumber}
                variant={
                  (modelStats.samplesPerString.get(s.stringNumber) ?? 0) > 0 ? "default" : "outline"
                }
                className="text-xs"
              >
                {s.name}: {modelStats.samplesPerString.get(s.stringNumber) ?? 0}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button size="sm" variant="outline" onClick={handleExportModel}>
              Export Model
            </Button>
            <Button size="sm" variant="outline" onClick={handleImportModel}>
              Import Model
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCrossValidate}
              disabled={modelStats.totalSamples < 10}
            >
              Cross-Validate
            </Button>
            <Button size="sm" variant="destructive" onClick={handleClearModel}>
              Clear Model
            </Button>
          </div>
        </CardContent>
      </Card>

      {mode === "audio" && (
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Saved Audio Samples</CardTitle>
          </CardHeader>
          <CardContent>
            <Fretboard markers={sampleCountMarkers} />
          </CardContent>
        </Card>
      )}

      {mode === "training" && (
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Training Data Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <Fretboard markers={trainingMarkers} />
            <p className="text-muted-foreground mt-4 text-sm">
              For best results, record samples at multiple fret positions (0, 3, 5, 7, 9, 12) for
              each string. Aim for 10-20 samples per string with varied dynamics.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
