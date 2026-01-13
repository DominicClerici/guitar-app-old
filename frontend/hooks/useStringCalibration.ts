"use client"

import { PitchDetector } from "pitchy"
import { useCallback, useEffect, useRef, useState } from "react"

import { saveCalibrationData, setActiveCalibration } from "@/lib/audio/calibration-storage"
import type {
  CalibratedStringProfile,
  CalibrationPhase,
  CalibrationStep,
  FretProfile,
  GuitarCalibrationData,
  TemporalProfile,
} from "@/lib/audio/calibration-types"
import { STANDARD_TUNING_STRINGS } from "@/lib/audio/guitar-constants"
import {
  calculateInharmonicityCoefficient,
  calculateSpectralFeatures,
  computeMagnitudeSpectrum,
  detectHarmonicPeaks,
  getNormalizedHarmonicAmplitudes,
} from "@/lib/audio/harmonic-analysis"

interface UseStringCalibrationOptions {
  samplesPerString?: number
  minClarity?: number
  fftSize?: number
}

interface UseStringCalibrationResult {
  status: "idle" | "calibrating" | "complete" | "error"
  currentStep: CalibrationStep
  currentStringNumber: number | null
  currentPhase: CalibrationPhase
  currentFret: number
  progress: number
  error: string | null
  collectedSamples: Map<string, number>
  startCalibration: (guitarName: string) => Promise<void>
  cancelCalibration: () => void
  skipString: () => void
  skipPhase: () => void
  calibrationData: GuitarCalibrationData | null
}

interface CollectedSample {
  inharmonicity: number
  centroid: number
  harmonicProfile: number[]
}

interface TemporalSamples {
  attack: CollectedSample[]
  sustain: CollectedSample[]
}

const DEFAULT_OPTIONS: Required<UseStringCalibrationOptions> = {
  samplesPerString: 10,
  minClarity: 0.9,
  fftSize: 8192,
}

const ATTACK_SAMPLES_REQUIRED = 7
const SUSTAIN_SAMPLES_REQUIRED = 7
const ATTACK_WINDOW_START_MS = 20
const ATTACK_WINDOW_END_MS = 100
const SUSTAIN_WINDOW_START_MS = 300
const SUSTAIN_WINDOW_END_MS = 500

const PITCH_TOLERANCE_CENTS = 50
const STRING_ORDER = [6, 5, 4, 3, 2, 1]
const CALIBRATION_FRETS = [0, 5, 12]
const PHASE_ORDER: CalibrationPhase[] = ["open", "fret5", "fret12"]

function getFretForPhase(phase: CalibrationPhase): number {
  if (phase === "open") return 0
  if (phase === "fret5") return 5
  return 12
}

function getSampleKey(stringNumber: number, fret: number): string {
  return `${stringNumber}-${fret}`
}

function getExpectedFrequency(stringNumber: number, fret: number): number {
  const profile = STANDARD_TUNING_STRINGS.find((s) => s.stringNumber === stringNumber)
  if (!profile) return 0
  return profile.openFreq * Math.pow(2, fret / 12)
}

function rejectOutliers(values: number[]): number[] {
  if (values.length < 4) return values

  const sorted = [...values].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]

  const absoluteDeviations = values.map((v) => Math.abs(v - median))
  const sortedDeviations = [...absoluteDeviations].sort((a, b) => a - b)
  const mad = sortedDeviations[Math.floor(sortedDeviations.length / 2)]

  if (mad === 0) return values

  const threshold = 2.5 * mad
  return values.filter((v) => Math.abs(v - median) <= threshold)
}

function centsFromFrequency(detected: number, expected: number): number {
  return 1200 * Math.log2(detected / expected)
}

export function useStringCalibration(
  options: UseStringCalibrationOptions = {},
): UseStringCalibrationResult {
  const [status, setStatus] = useState<"idle" | "calibrating" | "complete" | "error">("idle")
  const [currentStep, setCurrentStep] = useState<CalibrationStep>({ type: "idle" })
  const [currentStringNumber, setCurrentStringNumber] = useState<number | null>(null)
  const [currentPhase, setCurrentPhase] = useState<CalibrationPhase>("open")
  const [currentFret, setCurrentFret] = useState<number>(0)
  const [progress, setProgress] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [collectedSamples, setCollectedSamples] = useState<Map<string, number>>(new Map())
  const [calibrationData, setCalibrationData] = useState<GuitarCalibrationData | null>(null)

  const optionsRef = useRef({ ...DEFAULT_OPTIONS, ...options })
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const detectorRef = useRef<PitchDetector<Float32Array> | null>(null)
  const inputArrayRef = useRef<Float32Array<ArrayBuffer> | null>(null)

  const samplesRef = useRef<Map<string, TemporalSamples>>(new Map())
  const currentStringIndexRef = useRef<number>(0)
  const currentPhaseIndexRef = useRef<number>(0)
  const guitarNameRef = useRef<string>("")
  const calibrationIdRef = useRef<string>("")
  const processAudioRef = useRef<(() => void) | null>(null)
  const onsetTimeRef = useRef<number | null>(null)
  const previousPitchRef = useRef<number>(-1)

  useEffect(() => {
    optionsRef.current = { ...DEFAULT_OPTIONS, ...options }
  }, [options])

  const cleanup = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    analyserRef.current = null
    detectorRef.current = null
    inputArrayRef.current = null
  }, [])

  const buildTemporalProfile = (samples: CollectedSample[]): TemporalProfile => {
    if (samples.length === 0) {
      return {
        measuredInharmonicity: 0,
        spectralCentroidRange: { min: 0, max: 10000 },
        harmonicProfile: new Array(10).fill(0),
      }
    }

    const inharmonicityValues = samples.map((s) => s.inharmonicity)
    const filteredInharmonicity = rejectOutliers(inharmonicityValues)
    const avgInharmonicity =
      filteredInharmonicity.reduce((a, b) => a + b, 0) / filteredInharmonicity.length

    const centroidValues = samples.map((s) => s.centroid)
    const filteredCentroids = rejectOutliers(centroidValues)
    const minCentroid = Math.min(...filteredCentroids)
    const maxCentroid = Math.max(...filteredCentroids)

    const harmonicProfile = Array(10)
      .fill(0)
      .map((_, harmonicIndex) => {
        const valuesAtIndex = samples.map((s) => s.harmonicProfile[harmonicIndex] ?? 0)
        const filtered = rejectOutliers(valuesAtIndex)
        return filtered.length > 0 ? filtered.reduce((a, b) => a + b, 0) / filtered.length : 0
      })

    return {
      measuredInharmonicity: avgInharmonicity,
      spectralCentroidRange: { min: minCentroid, max: maxCentroid },
      harmonicProfile,
    }
  }

  const calculateProgress = useCallback(() => {
    const totalCalibrationPoints = PHASE_ORDER.length * STRING_ORDER.length
    const completedPhases = currentPhaseIndexRef.current
    const completedStringsInPhase = currentStringIndexRef.current
    const totalCompleted = completedPhases * STRING_ORDER.length + completedStringsInPhase
    return Math.round((totalCompleted / totalCalibrationPoints) * 100)
  }, [])

  const buildCalibrationData = useCallback(() => {
    const strings: CalibratedStringProfile[] = []
    const now = Date.now()

    for (const stringNum of STRING_ORDER) {
      const fretProfiles: FretProfile[] = []

      for (const fret of CALIBRATION_FRETS) {
        const key = getSampleKey(stringNum, fret)
        const temporalSamples = samplesRef.current.get(key)
        const attackSamples = temporalSamples?.attack || []
        const sustainSamples = temporalSamples?.sustain || []

        if (attackSamples.length > 0 || sustainSamples.length > 0) {
          fretProfiles.push({
            fret,
            attackProfile: buildTemporalProfile(attackSamples),
            sustainProfile: buildTemporalProfile(sustainSamples),
            sampleCount: attackSamples.length + sustainSamples.length,
          })
        }
      }

      const openKey = getSampleKey(stringNum, 0)
      const openSamples = samplesRef.current.get(openKey)
      const openAttack = openSamples?.attack || []
      const openSustain = openSamples?.sustain || []

      if (openAttack.length === 0 && openSustain.length === 0) {
        const profile = STANDARD_TUNING_STRINGS.find((s) => s.stringNumber === stringNum)
        const defaultInharmonicity = profile?.typicalInharmonicity ?? 0
        strings.push({
          stringNumber: stringNum,
          attackProfile: {
            measuredInharmonicity: defaultInharmonicity,
            spectralCentroidRange: { min: 0, max: 10000 },
            harmonicProfile: new Array(10).fill(0),
          },
          sustainProfile: {
            measuredInharmonicity: defaultInharmonicity * 0.8,
            spectralCentroidRange: { min: 0, max: 8000 },
            harmonicProfile: new Array(10).fill(0),
          },
          sampleCount: 0,
          calibratedAt: now,
          fretProfiles: fretProfiles.length > 0 ? fretProfiles : undefined,
        })
        continue
      }

      const attackProfile = buildTemporalProfile(openAttack)
      const sustainProfile = buildTemporalProfile(openSustain)

      strings.push({
        stringNumber: stringNum,
        attackProfile,
        sustainProfile,
        sampleCount: openAttack.length + openSustain.length,
        calibratedAt: now,
        fretProfiles: fretProfiles.length > 0 ? fretProfiles : undefined,
      })
    }

    return {
      id: calibrationIdRef.current,
      name: guitarNameRef.current,
      strings,
      createdAt: now,
      updatedAt: now,
    }
  }, [buildTemporalProfile])

  const finishCalibration = useCallback(() => {
    const data: GuitarCalibrationData = buildCalibrationData()
    saveCalibrationData(data)
    setActiveCalibration(data.id)
    setCalibrationData(data)
    setCurrentStep({ type: "idle" })
    setCurrentStringNumber(null)
    setProgress(100)
    setStatus("complete")
    cleanup()
  }, [buildCalibrationData, cleanup])

  const moveToNextPhase = useCallback(() => {
    currentPhaseIndexRef.current += 1

    if (currentPhaseIndexRef.current >= PHASE_ORDER.length) {
      finishCalibration()
      return
    }

    const nextPhase = PHASE_ORDER[currentPhaseIndexRef.current]
    const nextFret = getFretForPhase(nextPhase)
    currentStringIndexRef.current = 0

    setCurrentPhase(nextPhase)
    setCurrentFret(nextFret)

    const firstString = STRING_ORDER[0]
    setCurrentStringNumber(firstString)
    setCurrentStep({
      type: "listening",
      stringNumber: firstString,
      fret: nextFret,
      attackSamples: 0,
      sustainSamples: 0,
    })
    setProgress(calculateProgress())

    onsetTimeRef.current = null
    previousPitchRef.current = -1

    if (processAudioRef.current) {
      animationFrameRef.current = requestAnimationFrame(processAudioRef.current)
    }
  }, [calculateProgress, finishCalibration])

  const moveToNextString = useCallback(() => {
    currentStringIndexRef.current += 1
    onsetTimeRef.current = null
    previousPitchRef.current = -1

    if (currentStringIndexRef.current >= STRING_ORDER.length) {
      const completedPhase = PHASE_ORDER[currentPhaseIndexRef.current]
      setCurrentStep({ type: "phase-complete", phase: completedPhase })
      setTimeout(() => {
        moveToNextPhase()
      }, 1000)
      return
    }

    const currentPhaseValue = PHASE_ORDER[currentPhaseIndexRef.current]
    const currentFretValue = getFretForPhase(currentPhaseValue)
    const nextString = STRING_ORDER[currentStringIndexRef.current]

    setCurrentStringNumber(nextString)
    setCurrentStep({
      type: "listening",
      stringNumber: nextString,
      fret: currentFretValue,
      attackSamples: 0,
      sustainSamples: 0,
    })
    setProgress(calculateProgress())

    onsetTimeRef.current = null
    previousPitchRef.current = -1

    if (processAudioRef.current) {
      animationFrameRef.current = requestAnimationFrame(processAudioRef.current)
    }
  }, [calculateProgress, moveToNextPhase])

  const processAudio = useCallback(() => {
    const analyser = analyserRef.current
    const detector = detectorRef.current
    const input = inputArrayRef.current
    const audioContext = audioContextRef.current

    if (!analyser || !detector || !input || !audioContext) return

    analyser.getFloatTimeDomainData(input)
    const [detectedPitch, detectedClarity] = detector.findPitch(input, audioContext.sampleRate)

    const previousPitch = previousPitchRef.current
    const now = Date.now()

    if (detectedClarity >= optionsRef.current.minClarity && detectedPitch > 0) {
      if (previousPitch <= 0) {
        onsetTimeRef.current = now
      }
      previousPitchRef.current = detectedPitch

      const currentString = STRING_ORDER[currentStringIndexRef.current]
      const currentPhaseValue = PHASE_ORDER[currentPhaseIndexRef.current]
      const currentFretValue = getFretForPhase(currentPhaseValue)
      const expectedFreq = getExpectedFrequency(currentString, currentFretValue)

      if (expectedFreq > 0) {
        const centsOff = centsFromFrequency(detectedPitch, expectedFreq)

        if (Math.abs(centsOff) <= PITCH_TOLERANCE_CENTS && onsetTimeRef.current !== null) {
          const timeSinceOnset = now - onsetTimeRef.current

          const isAttackWindow =
            timeSinceOnset >= ATTACK_WINDOW_START_MS && timeSinceOnset <= ATTACK_WINDOW_END_MS
          const isSustainWindow =
            timeSinceOnset >= SUSTAIN_WINDOW_START_MS && timeSinceOnset <= SUSTAIN_WINDOW_END_MS

          if (isAttackWindow || isSustainWindow) {
            const { frequencies, magnitudes } = computeMagnitudeSpectrum(
              analyser,
              optionsRef.current.fftSize,
            )

            const harmonicPeaks = detectHarmonicPeaks(frequencies, magnitudes, detectedPitch)
            const inharmonicity = calculateInharmonicityCoefficient(harmonicPeaks)
            const spectralFeatures = calculateSpectralFeatures(frequencies, magnitudes)
            const normalizedHarmonics = getNormalizedHarmonicAmplitudes(harmonicPeaks)

            const sample: CollectedSample = {
              inharmonicity,
              centroid: spectralFeatures.centroid,
              harmonicProfile: normalizedHarmonics,
            }

            const sampleKey = getSampleKey(currentString, currentFretValue)
            const existingSamples = samplesRef.current.get(sampleKey) || {
              attack: [],
              sustain: [],
            }

            if (isAttackWindow && existingSamples.attack.length < ATTACK_SAMPLES_REQUIRED) {
              existingSamples.attack.push(sample)
            } else if (
              isSustainWindow &&
              existingSamples.sustain.length < SUSTAIN_SAMPLES_REQUIRED
            ) {
              existingSamples.sustain.push(sample)
            }

            samplesRef.current.set(sampleKey, existingSamples)

            const countsMap = new Map<string, number>()
            for (const [key, samples] of samplesRef.current) {
              countsMap.set(key, samples.attack.length + samples.sustain.length)
            }
            setCollectedSamples(countsMap)
            setCurrentStep({
              type: "listening",
              stringNumber: currentString,
              fret: currentFretValue,
              attackSamples: existingSamples.attack.length,
              sustainSamples: existingSamples.sustain.length,
            })

            const isComplete =
              existingSamples.attack.length >= ATTACK_SAMPLES_REQUIRED &&
              existingSamples.sustain.length >= SUSTAIN_SAMPLES_REQUIRED

            if (isComplete) {
              setCurrentStep({ type: "complete", stringNumber: currentString, fret: currentFretValue })
              setTimeout(() => {
                moveToNextString()
              }, 500)
              return
            }
          }
        }
      }
    } else {
      previousPitchRef.current = -1
      onsetTimeRef.current = null
    }

    animationFrameRef.current = requestAnimationFrame(processAudio)
  }, [moveToNextString])

  useEffect(() => {
    processAudioRef.current = processAudio
  }, [processAudio])

  const startCalibration = useCallback(
    async (guitarName: string) => {
      try {
        setStatus("calibrating")
        setError(null)
        setCalibrationData(null)
        setCollectedSamples(new Map())

        samplesRef.current = new Map()
        currentStringIndexRef.current = 0
        currentPhaseIndexRef.current = 0
        guitarNameRef.current = guitarName
        calibrationIdRef.current = crypto.randomUUID()

        const firstPhase = PHASE_ORDER[0]
        const firstFret = getFretForPhase(firstPhase)
        const firstString = STRING_ORDER[0]

        setCurrentPhase(firstPhase)
        setCurrentFret(firstFret)
        setCurrentStringNumber(firstString)
        setCurrentStep({
          type: "listening",
          stringNumber: firstString,
          fret: firstFret,
          attackSamples: 0,
          sustainSamples: 0,
        })
        setProgress(0)
        onsetTimeRef.current = null
        previousPitchRef.current = -1

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream

        const audioContext = new AudioContext()
        audioContextRef.current = audioContext

        const analyser = audioContext.createAnalyser()
        analyser.fftSize = optionsRef.current.fftSize
        analyser.smoothingTimeConstant = 0.1
        analyserRef.current = analyser

        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)

        detectorRef.current = PitchDetector.forFloat32Array(analyser.fftSize)
        inputArrayRef.current = new Float32Array(analyser.fftSize)

        animationFrameRef.current = requestAnimationFrame(processAudio)
      } catch (err) {
        console.error("Failed to start calibration:", err)
        setError(err instanceof Error ? err.message : "Failed to start calibration")
        setStatus("error")
        setCurrentStep({ type: "error", message: "Failed to access microphone" })
        cleanup()
      }
    },
    [processAudio, cleanup],
  )

  const cancelCalibration = useCallback(() => {
    cleanup()
    samplesRef.current = new Map()
    currentStringIndexRef.current = 0
    currentPhaseIndexRef.current = 0
    setStatus("idle")
    setCurrentStep({ type: "idle" })
    setCurrentStringNumber(null)
    setCurrentPhase("open")
    setCurrentFret(0)
    setProgress(0)
    setError(null)
    setCollectedSamples(new Map())
    setCalibrationData(null)
  }, [cleanup])

  const skipString = useCallback(() => {
    if (status !== "calibrating") return
    moveToNextString()
  }, [status, moveToNextString])

  const skipPhase = useCallback(() => {
    if (status !== "calibrating") return
    if (currentPhaseIndexRef.current === 0) {
      return
    }
    moveToNextPhase()
  }, [status, moveToNextPhase])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    status,
    currentStep,
    currentStringNumber,
    currentPhase,
    currentFret,
    progress,
    error,
    collectedSamples,
    startCalibration,
    cancelCalibration,
    skipString,
    skipPhase,
    calibrationData,
  }
}
