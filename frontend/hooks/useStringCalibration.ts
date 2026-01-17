"use client"

import { PitchDetector } from "pitchy"
import { useCallback, useEffect, useRef, useState } from "react"

import { saveCalibrationData, setActiveCalibration } from "@/lib/audio/calibration-storage"
import type {
  CalibratedStringProfile,
  CalibrationPhase,
  CalibrationStep,
  CalibrationValidationResult,
  FretProfile,
  GuitarCalibrationData,
  TemporalProfile,
} from "@/lib/audio/calibration-types"
import { validateCalibrationData } from "@/lib/audio/calibration-validation"
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
  validationResult: CalibrationValidationResult | null
}

interface CollectedSample {
  inharmonicity: number
  centroid: number
  harmonicProfile: number[]
}

interface PluckSamples {
  attack: CollectedSample[]
  sustain: CollectedSample[]
}

interface MultiPluckSamples {
  plucks: PluckSamples[]
  currentPluckIndex: number
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
const PLUCKS_REQUIRED = 5

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

function getAveragedTemporalSamples(multiPluck: MultiPluckSamples): TemporalSamples {
  const attackSamples: CollectedSample[] = []
  const sustainSamples: CollectedSample[] = []

  for (let sampleIdx = 0; sampleIdx < ATTACK_SAMPLES_REQUIRED; sampleIdx++) {
    const samplesAtIndex: CollectedSample[] = []
    for (const pluck of multiPluck.plucks) {
      if (pluck.attack[sampleIdx]) {
        samplesAtIndex.push(pluck.attack[sampleIdx])
      }
    }
    if (samplesAtIndex.length > 0) {
      const avgInharmonicity =
        samplesAtIndex.reduce((a, b) => a + b.inharmonicity, 0) / samplesAtIndex.length
      const avgCentroid = samplesAtIndex.reduce((a, b) => a + b.centroid, 0) / samplesAtIndex.length
      const avgHarmonics = samplesAtIndex[0].harmonicProfile.map((_, i) => {
        const values = samplesAtIndex.map((s) => s.harmonicProfile[i] ?? 0)
        return values.reduce((a, b) => a + b, 0) / values.length
      })
      attackSamples.push({
        inharmonicity: avgInharmonicity,
        centroid: avgCentroid,
        harmonicProfile: avgHarmonics,
      })
    }
  }

  for (let sampleIdx = 0; sampleIdx < SUSTAIN_SAMPLES_REQUIRED; sampleIdx++) {
    const samplesAtIndex: CollectedSample[] = []
    for (const pluck of multiPluck.plucks) {
      if (pluck.sustain[sampleIdx]) {
        samplesAtIndex.push(pluck.sustain[sampleIdx])
      }
    }
    if (samplesAtIndex.length > 0) {
      const avgInharmonicity =
        samplesAtIndex.reduce((a, b) => a + b.inharmonicity, 0) / samplesAtIndex.length
      const avgCentroid = samplesAtIndex.reduce((a, b) => a + b.centroid, 0) / samplesAtIndex.length
      const avgHarmonics = samplesAtIndex[0].harmonicProfile.map((_, i) => {
        const values = samplesAtIndex.map((s) => s.harmonicProfile[i] ?? 0)
        return values.reduce((a, b) => a + b, 0) / values.length
      })
      sustainSamples.push({
        inharmonicity: avgInharmonicity,
        centroid: avgCentroid,
        harmonicProfile: avgHarmonics,
      })
    }
  }

  return { attack: attackSamples, sustain: sustainSamples }
}

function detectGStringWoundStatus(samplesMap: Map<string, MultiPluckSamples>): boolean | undefined {
  const gStringKey = getSampleKey(3, 0)
  const dStringKey = getSampleKey(4, 0)
  const bStringKey = getSampleKey(2, 0)

  const gMultiPluck = samplesMap.get(gStringKey)
  const dMultiPluck = samplesMap.get(dStringKey)
  const bMultiPluck = samplesMap.get(bStringKey)

  if (!gMultiPluck || gMultiPluck.plucks.length === 0) {
    return undefined
  }

  const gSamples = getAveragedTemporalSamples(gMultiPluck)
  const dSamples = dMultiPluck ? getAveragedTemporalSamples(dMultiPluck) : null
  const bSamples = bMultiPluck ? getAveragedTemporalSamples(bMultiPluck) : null

  if (gSamples.attack.length === 0) {
    return undefined
  }

  const gAttackCentroids = gSamples.attack.map((s) => s.centroid)
  const avgGCentroid = gAttackCentroids.reduce((a, b) => a + b, 0) / gAttackCentroids.length

  const gHarmonicProfiles = gSamples.attack.map((s) => s.harmonicProfile)
  const avgGHarmonics = gHarmonicProfiles[0].map((_, i) => {
    const values = gHarmonicProfiles.map((p) => p[i] ?? 0)
    return values.reduce((a, b) => a + b, 0) / values.length
  })

  let dAvgCentroid: number | null = null
  let bAvgCentroid: number | null = null

  if (dSamples && dSamples.attack.length > 0) {
    const dCentroids = dSamples.attack.map((s) => s.centroid)
    dAvgCentroid = dCentroids.reduce((a, b) => a + b, 0) / dCentroids.length
  }

  if (bSamples && bSamples.attack.length > 0) {
    const bCentroids = bSamples.attack.map((s) => s.centroid)
    bAvgCentroid = bCentroids.reduce((a, b) => a + b, 0) / bCentroids.length
  }

  let woundScore = 0

  if (avgGCentroid < 900) {
    woundScore += 2
  } else if (avgGCentroid > 1200) {
    woundScore -= 2
  } else if (avgGCentroid >= 900 && avgGCentroid <= 1200) {
    woundScore += avgGCentroid < 1050 ? 1 : -1
  }

  if (dAvgCentroid !== null && bAvgCentroid !== null) {
    const midpoint = (dAvgCentroid + bAvgCentroid) / 2
    if (avgGCentroid < midpoint) {
      woundScore += 2
    } else {
      woundScore -= 2
    }
  } else if (dAvgCentroid !== null) {
    const centroidRatio = avgGCentroid / dAvgCentroid
    if (centroidRatio < 1.3) {
      woundScore += 1
    } else if (centroidRatio > 1.8) {
      woundScore -= 1
    }
  } else if (bAvgCentroid !== null) {
    const centroidRatio = avgGCentroid / bAvgCentroid
    if (centroidRatio < 0.7) {
      woundScore += 1
    } else if (centroidRatio > 0.9) {
      woundScore -= 1
    }
  }

  const lowerHarmonicSum = avgGHarmonics.slice(0, 3).reduce((a, b) => a + b, 0)
  const higherHarmonicSum = avgGHarmonics.slice(3, 7).reduce((a, b) => a + b, 0)

  if (higherHarmonicSum > 0) {
    const harmonicRatio = lowerHarmonicSum / higherHarmonicSum
    if (harmonicRatio > 2.5) {
      woundScore += 1
    } else if (harmonicRatio < 1.5) {
      woundScore -= 1
    }
  }

  return woundScore > 0
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
  const [validationResult, setValidationResult] = useState<CalibrationValidationResult | null>(null)

  const optionsRef = useRef({ ...DEFAULT_OPTIONS, ...options })
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const detectorRef = useRef<PitchDetector<Float32Array> | null>(null)
  const inputArrayRef = useRef<Float32Array<ArrayBuffer> | null>(null)

  const samplesRef = useRef<Map<string, MultiPluckSamples>>(new Map())
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
        const multiPluckSamples = samplesRef.current.get(key)

        if (multiPluckSamples && multiPluckSamples.plucks.length > 0) {
          const averagedSamples = getAveragedTemporalSamples(multiPluckSamples)
          const attackSamples = averagedSamples.attack
          const sustainSamples = averagedSamples.sustain

          if (attackSamples.length > 0 || sustainSamples.length > 0) {
            const totalSampleCount = multiPluckSamples.plucks.reduce(
              (acc, p) => acc + p.attack.length + p.sustain.length,
              0,
            )
            fretProfiles.push({
              fret,
              attackProfile: buildTemporalProfile(attackSamples),
              sustainProfile: buildTemporalProfile(sustainSamples),
              sampleCount: totalSampleCount,
            })
          }
        }
      }

      const openKey = getSampleKey(stringNum, 0)
      const openMultiPluck = samplesRef.current.get(openKey)

      if (!openMultiPluck || openMultiPluck.plucks.length === 0) {
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

      const averagedOpenSamples = getAveragedTemporalSamples(openMultiPluck)
      const openAttack = averagedOpenSamples.attack
      const openSustain = averagedOpenSamples.sustain

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
      const totalSampleCount = openMultiPluck.plucks.reduce(
        (acc, p) => acc + p.attack.length + p.sustain.length,
        0,
      )

      strings.push({
        stringNumber: stringNum,
        attackProfile,
        sustainProfile,
        sampleCount: totalSampleCount,
        calibratedAt: now,
        fretProfiles: fretProfiles.length > 0 ? fretProfiles : undefined,
      })
    }

    const isGStringWound = detectGStringWoundStatus(samplesRef.current)

    return {
      id: calibrationIdRef.current,
      name: guitarNameRef.current,
      strings,
      createdAt: now,
      updatedAt: now,
      isGStringWound,
    }
  }, [buildTemporalProfile])

  const finishCalibration = useCallback(() => {
    const data: GuitarCalibrationData = buildCalibrationData()
    console.log("data", data)
    const validation = validateCalibrationData(data)
    saveCalibrationData(data)
    setActiveCalibration(data.id)
    setCalibrationData(data)
    setValidationResult(validation)
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
    const sampleKey = getSampleKey(firstString, nextFret)
    samplesRef.current.set(sampleKey, {
      plucks: [{ attack: [], sustain: [] }],
      currentPluckIndex: 0,
    })

    setCurrentStringNumber(firstString)
    setCurrentStep({
      type: "listening",
      stringNumber: firstString,
      fret: nextFret,
      attackSamples: 0,
      sustainSamples: 0,
      currentPluck: 1,
      totalPlucks: PLUCKS_REQUIRED,
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
      }, 5000)
      return
    }

    const currentPhaseValue = PHASE_ORDER[currentPhaseIndexRef.current]
    const currentFretValue = getFretForPhase(currentPhaseValue)
    const nextString = STRING_ORDER[currentStringIndexRef.current]

    const sampleKey = getSampleKey(nextString, currentFretValue)
    samplesRef.current.set(sampleKey, {
      plucks: [{ attack: [], sustain: [] }],
      currentPluckIndex: 0,
    })

    setCurrentStringNumber(nextString)
    setCurrentStep({
      type: "listening",
      stringNumber: nextString,
      fret: currentFretValue,
      attackSamples: 0,
      sustainSamples: 0,
      currentPluck: 1,
      totalPlucks: PLUCKS_REQUIRED,
    })
    setProgress(calculateProgress())

    onsetTimeRef.current = null
    previousPitchRef.current = -1

    if (processAudioRef.current) {
      animationFrameRef.current = requestAnimationFrame(processAudioRef.current)
    }
  }, [calculateProgress, moveToNextPhase])

  const moveToNextPluck = useCallback(() => {
    onsetTimeRef.current = null
    previousPitchRef.current = -1

    const currentString = STRING_ORDER[currentStringIndexRef.current]
    const currentPhaseValue = PHASE_ORDER[currentPhaseIndexRef.current]
    const currentFretValue = getFretForPhase(currentPhaseValue)
    const sampleKey = getSampleKey(currentString, currentFretValue)

    const existingMultiPluck = samplesRef.current.get(sampleKey)
    if (!existingMultiPluck) return

    const nextPluckIndex = existingMultiPluck.currentPluckIndex + 1

    if (nextPluckIndex >= PLUCKS_REQUIRED) {
      setCurrentStep({
        type: "complete",
        stringNumber: currentString,
        fret: currentFretValue,
      })
      setTimeout(() => {
        moveToNextString()
      }, 2000)
      return
    }

    existingMultiPluck.plucks.push({ attack: [], sustain: [] })
    existingMultiPluck.currentPluckIndex = nextPluckIndex
    samplesRef.current.set(sampleKey, existingMultiPluck)

    setCurrentStep({
      type: "listening",
      stringNumber: currentString,
      fret: currentFretValue,
      attackSamples: 0,
      sustainSamples: 0,
      currentPluck: nextPluckIndex + 1,
      totalPlucks: PLUCKS_REQUIRED,
    })

    if (processAudioRef.current) {
      animationFrameRef.current = requestAnimationFrame(processAudioRef.current)
    }
  }, [moveToNextString])

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
            let existingMultiPluck = samplesRef.current.get(sampleKey)
            if (!existingMultiPluck) {
              existingMultiPluck = { plucks: [{ attack: [], sustain: [] }], currentPluckIndex: 0 }
              samplesRef.current.set(sampleKey, existingMultiPluck)
            }

            const currentPluck = existingMultiPluck.plucks[existingMultiPluck.currentPluckIndex]
            if (!currentPluck) return

            if (isAttackWindow && currentPluck.attack.length < ATTACK_SAMPLES_REQUIRED) {
              currentPluck.attack.push(sample)
            } else if (isSustainWindow && currentPluck.sustain.length < SUSTAIN_SAMPLES_REQUIRED) {
              currentPluck.sustain.push(sample)
            }

            const countsMap = new Map<string, number>()
            for (const [key, multiPluck] of samplesRef.current) {
              const totalSamples = multiPluck.plucks.reduce(
                (acc, p) => acc + p.attack.length + p.sustain.length,
                0,
              )
              countsMap.set(key, totalSamples)
            }
            setCollectedSamples(countsMap)

            setCurrentStep({
              type: "listening",
              stringNumber: currentString,
              fret: currentFretValue,
              attackSamples: currentPluck.attack.length,
              sustainSamples: currentPluck.sustain.length,
              currentPluck: existingMultiPluck.currentPluckIndex + 1,
              totalPlucks: PLUCKS_REQUIRED,
            })

            const isPluckComplete =
              currentPluck.attack.length >= ATTACK_SAMPLES_REQUIRED &&
              currentPluck.sustain.length >= SUSTAIN_SAMPLES_REQUIRED

            if (isPluckComplete) {
              const nextPluckIndex = existingMultiPluck.currentPluckIndex + 1
              const isAllPlucksComplete = nextPluckIndex >= PLUCKS_REQUIRED

              if (isAllPlucksComplete) {
                setCurrentStep({
                  type: "complete",
                  stringNumber: currentString,
                  fret: currentFretValue,
                })
                setTimeout(() => {
                  moveToNextString()
                }, 2000)
                return
              } else {
                setCurrentStep({
                  type: "pluck-complete",
                  stringNumber: currentString,
                  fret: currentFretValue,
                  pluckNumber: existingMultiPluck.currentPluckIndex + 1,
                  totalPlucks: PLUCKS_REQUIRED,
                })
                setTimeout(() => {
                  moveToNextPluck()
                }, 1500)
                return
              }
            }
          }
        }
      }
    } else {
      previousPitchRef.current = -1
      onsetTimeRef.current = null
    }

    animationFrameRef.current = requestAnimationFrame(processAudio)
  }, [moveToNextString, moveToNextPluck])

  useEffect(() => {
    processAudioRef.current = processAudio
  }, [processAudio])

  const startCalibration = useCallback(
    async (guitarName: string) => {
      try {
        setStatus("calibrating")
        setError(null)
        setCalibrationData(null)
        setValidationResult(null)
        setCollectedSamples(new Map())

        samplesRef.current = new Map()
        currentStringIndexRef.current = 0
        currentPhaseIndexRef.current = 0
        guitarNameRef.current = guitarName
        calibrationIdRef.current = crypto.randomUUID()

        const firstPhase = PHASE_ORDER[0]
        const firstFret = getFretForPhase(firstPhase)
        const firstString = STRING_ORDER[0]

        const sampleKey = getSampleKey(firstString, firstFret)
        samplesRef.current.set(sampleKey, {
          plucks: [{ attack: [], sustain: [] }],
          currentPluckIndex: 0,
        })

        setCurrentPhase(firstPhase)
        setCurrentFret(firstFret)
        setCurrentStringNumber(firstString)
        setCurrentStep({
          type: "listening",
          stringNumber: firstString,
          fret: firstFret,
          attackSamples: 0,
          sustainSamples: 0,
          currentPluck: 1,
          totalPlucks: PLUCKS_REQUIRED,
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
    setValidationResult(null)
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
    validationResult,
  }
}
