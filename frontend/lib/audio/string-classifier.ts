"use client"

import type {
  CalibratedStringProfile,
  FretProfile,
  GuitarCalibrationData,
  TemporalProfile,
} from "./calibration-types"
import type {
  SpectralFeatures,
  StringCandidate,
  StringDetectionResult,
} from "./guitar-constants"
import {
  getCandidateStrings,
  getStringProfile,
  STANDARD_TUNING_STRINGS,
} from "./guitar-constants"

const ATTACK_SUSTAIN_TRANSITION_START_MS = 100
const ATTACK_SUSTAIN_TRANSITION_END_MS = 200

interface CandidateScore {
  candidate: StringCandidate
  inharmonicityScore: number
  spectralScore: number
  harmonicScore: number
  totalScore: number
}

let activeCalibration: GuitarCalibrationData | null = null

export function setActiveCalibrationProfile(data: GuitarCalibrationData | null): void {
  activeCalibration = data
}

export function getActiveCalibrationProfile(): GuitarCalibrationData | null {
  return activeCalibration
}

function getCalibratedProfile(stringNumber: number): CalibratedStringProfile | undefined {
  if (!activeCalibration) return undefined
  return activeCalibration.strings.find((s) => s.stringNumber === stringNumber)
}

function hasTemporalProfiles(profile: CalibratedStringProfile): boolean {
  return "attackProfile" in profile && "sustainProfile" in profile
}

function blendTemporalProfiles(
  attack: TemporalProfile,
  sustain: TemporalProfile,
  timeSinceOnsetMs: number,
): TemporalProfile {
  if (timeSinceOnsetMs < ATTACK_SUSTAIN_TRANSITION_START_MS) {
    return attack
  }

  if (timeSinceOnsetMs >= ATTACK_SUSTAIN_TRANSITION_END_MS) {
    return sustain
  }

  const blendFactor =
    (timeSinceOnsetMs - ATTACK_SUSTAIN_TRANSITION_START_MS) /
    (ATTACK_SUSTAIN_TRANSITION_END_MS - ATTACK_SUSTAIN_TRANSITION_START_MS)

  return {
    measuredInharmonicity:
      attack.measuredInharmonicity * (1 - blendFactor) +
      sustain.measuredInharmonicity * blendFactor,
    spectralCentroidRange: {
      min:
        attack.spectralCentroidRange.min * (1 - blendFactor) +
        sustain.spectralCentroidRange.min * blendFactor,
      max:
        attack.spectralCentroidRange.max * (1 - blendFactor) +
        sustain.spectralCentroidRange.max * blendFactor,
    },
    harmonicProfile: attack.harmonicProfile.map(
      (val, i) => val * (1 - blendFactor) + (sustain.harmonicProfile[i] ?? 0) * blendFactor,
    ),
  }
}

function getTemporalProfile(
  calibrated: CalibratedStringProfile,
  timeSinceOnsetMs?: number,
): TemporalProfile | null {
  if (!hasTemporalProfiles(calibrated) || calibrated.sampleCount === 0) {
    return null
  }

  if (timeSinceOnsetMs === undefined || timeSinceOnsetMs < ATTACK_SUSTAIN_TRANSITION_START_MS) {
    return calibrated.attackProfile
  }

  if (timeSinceOnsetMs >= ATTACK_SUSTAIN_TRANSITION_END_MS) {
    return calibrated.sustainProfile
  }

  return blendTemporalProfiles(
    calibrated.attackProfile,
    calibrated.sustainProfile,
    timeSinceOnsetMs,
  )
}

function interpolateTemporalProfiles(
  lower: TemporalProfile,
  upper: TemporalProfile,
  t: number,
): TemporalProfile {
  return {
    measuredInharmonicity:
      lower.measuredInharmonicity * (1 - t) + upper.measuredInharmonicity * t,
    spectralCentroidRange: {
      min: lower.spectralCentroidRange.min * (1 - t) + upper.spectralCentroidRange.min * t,
      max: lower.spectralCentroidRange.max * (1 - t) + upper.spectralCentroidRange.max * t,
    },
    harmonicProfile: lower.harmonicProfile.map(
      (val, i) => val * (1 - t) + (upper.harmonicProfile[i] ?? 0) * t,
    ),
  }
}

function getFretProfileTemporalProfile(
  fretProfile: FretProfile,
  timeSinceOnsetMs?: number,
): TemporalProfile {
  if (timeSinceOnsetMs === undefined || timeSinceOnsetMs < ATTACK_SUSTAIN_TRANSITION_START_MS) {
    return fretProfile.attackProfile
  }

  if (timeSinceOnsetMs >= ATTACK_SUSTAIN_TRANSITION_END_MS) {
    return fretProfile.sustainProfile
  }

  return blendTemporalProfiles(
    fretProfile.attackProfile,
    fretProfile.sustainProfile,
    timeSinceOnsetMs,
  )
}

function getInterpolatedProfile(
  calibrated: CalibratedStringProfile,
  fret: number,
  timeSinceOnsetMs?: number,
): TemporalProfile | null {
  if (!calibrated.fretProfiles || calibrated.fretProfiles.length === 0) {
    return getTemporalProfile(calibrated, timeSinceOnsetMs)
  }

  const sortedProfiles = [...calibrated.fretProfiles].sort((a, b) => a.fret - b.fret)

  if (sortedProfiles.length === 1) {
    const only = sortedProfiles[0]
    if (fret === only.fret) {
      return getFretProfileTemporalProfile(only, timeSinceOnsetMs)
    }
    return getTemporalProfile(calibrated, timeSinceOnsetMs)
  }

  let lowerProfile: FretProfile | null = null
  let upperProfile: FretProfile | null = null

  for (const fp of sortedProfiles) {
    if (fp.fret <= fret) {
      lowerProfile = fp
    }
    if (fp.fret >= fret && upperProfile === null) {
      upperProfile = fp
    }
  }

  if (lowerProfile && upperProfile && lowerProfile.fret === upperProfile.fret) {
    return getFretProfileTemporalProfile(lowerProfile, timeSinceOnsetMs)
  }

  if (!lowerProfile && upperProfile) {
    return getFretProfileTemporalProfile(upperProfile, timeSinceOnsetMs)
  }

  if (lowerProfile && !upperProfile) {
    const secondHighest = sortedProfiles[sortedProfiles.length - 2]
    const highest = sortedProfiles[sortedProfiles.length - 1]

    if (secondHighest && highest && secondHighest.fret !== highest.fret) {
      const lowerTemp = getFretProfileTemporalProfile(secondHighest, timeSinceOnsetMs)
      const upperTemp = getFretProfileTemporalProfile(highest, timeSinceOnsetMs)

      const fretDiff = highest.fret - secondHighest.fret
      const slope = {
        inharmonicity:
          (upperTemp.measuredInharmonicity - lowerTemp.measuredInharmonicity) / fretDiff,
        centroidMin:
          (upperTemp.spectralCentroidRange.min - lowerTemp.spectralCentroidRange.min) / fretDiff,
        centroidMax:
          (upperTemp.spectralCentroidRange.max - lowerTemp.spectralCentroidRange.max) / fretDiff,
        harmonics: upperTemp.harmonicProfile.map(
          (val, i) => (val - (lowerTemp.harmonicProfile[i] ?? 0)) / fretDiff,
        ),
      }

      const extraFrets = fret - highest.fret
      return {
        measuredInharmonicity:
          upperTemp.measuredInharmonicity + slope.inharmonicity * extraFrets,
        spectralCentroidRange: {
          min: upperTemp.spectralCentroidRange.min + slope.centroidMin * extraFrets,
          max: upperTemp.spectralCentroidRange.max + slope.centroidMax * extraFrets,
        },
        harmonicProfile: upperTemp.harmonicProfile.map(
          (val, i) => val + (slope.harmonics[i] ?? 0) * extraFrets,
        ),
      }
    }

    return getFretProfileTemporalProfile(lowerProfile, timeSinceOnsetMs)
  }

  if (lowerProfile && upperProfile) {
    const t = (fret - lowerProfile.fret) / (upperProfile.fret - lowerProfile.fret)
    const lowerTemp = getFretProfileTemporalProfile(lowerProfile, timeSinceOnsetMs)
    const upperTemp = getFretProfileTemporalProfile(upperProfile, timeSinceOnsetMs)
    return interpolateTemporalProfiles(lowerTemp, upperTemp, t)
  }

  return getTemporalProfile(calibrated, timeSinceOnsetMs)
}

const INHARMONICITY_WEIGHT = 0.5
const SPECTRAL_WEIGHT = 0.3
const HARMONIC_WEIGHT = 0.2

function calculateExpectedInharmonicity(
  stringNumber: number,
  fret: number,
  timeSinceOnsetMs?: number,
): number {
  const calibrated = getCalibratedProfile(stringNumber)
  if (calibrated && calibrated.sampleCount > 0) {
    const interpolatedProfile = getInterpolatedProfile(calibrated, fret, timeSinceOnsetMs)
    if (interpolatedProfile) {
      return interpolatedProfile.measuredInharmonicity
    }
  }

  const profile = getStringProfile(stringNumber)
  if (!profile) return 0

  const fretFactor = 1 + fret * 0.05
  return profile.typicalInharmonicity * fretFactor
}

function scoreInharmonicity(
  measuredB: number,
  candidate: StringCandidate,
  timeSinceOnsetMs?: number,
): number {
  const expectedB = calculateExpectedInharmonicity(
    candidate.stringNumber,
    candidate.fretNumber,
    timeSinceOnsetMs,
  )

  if (expectedB === 0 && measuredB === 0) return 1

  const ratio = measuredB / (expectedB + 1e-10)
  const logRatio = Math.log10(ratio + 0.1)

  return Math.exp(-logRatio * logRatio * 2)
}

function getExpectedCentroidRange(
  stringNumber: number,
  fret: number,
  timeSinceOnsetMs?: number,
): { min: number; max: number } {
  const calibrated = getCalibratedProfile(stringNumber)
  if (calibrated && calibrated.sampleCount > 0) {
    const interpolatedProfile = getInterpolatedProfile(calibrated, fret, timeSinceOnsetMs)
    if (interpolatedProfile) {
      const margin =
        (interpolatedProfile.spectralCentroidRange.max -
          interpolatedProfile.spectralCentroidRange.min) *
        0.2
      return {
        min: interpolatedProfile.spectralCentroidRange.min - margin,
        max: interpolatedProfile.spectralCentroidRange.max + margin,
      }
    }
  }

  const profile = getStringProfile(stringNumber)
  if (!profile) return { min: 0, max: 10000 }

  if (profile.isWound) {
    return { min: 200, max: 800 }
  } else {
    return { min: 600, max: 2000 }
  }
}

function scoreSpectralFeatures(
  features: SpectralFeatures,
  candidate: StringCandidate,
  timeSinceOnsetMs?: number,
): number {
  const centroidRange = getExpectedCentroidRange(
    candidate.stringNumber,
    candidate.fretNumber,
    timeSinceOnsetMs,
  )
  const profile = getStringProfile(candidate.stringNumber)

  let centroidScore = 0
  if (features.centroid >= centroidRange.min && features.centroid <= centroidRange.max) {
    const rangeCenter = (centroidRange.min + centroidRange.max) / 2
    const rangeWidth = centroidRange.max - centroidRange.min
    const distance = Math.abs(features.centroid - rangeCenter) / rangeWidth
    centroidScore = Math.exp(-distance * distance * 2)
  } else {
    const distanceOutside = Math.min(
      Math.abs(features.centroid - centroidRange.min),
      Math.abs(features.centroid - centroidRange.max),
    )
    centroidScore = Math.exp(-distanceOutside / 200)
  }

  let flatnessScore = 0.5
  if (profile) {
    if (profile.isWound) {
      flatnessScore = features.flatness < 0.3 ? 0.8 : 0.4
    } else {
      flatnessScore = features.flatness >= 0.2 ? 0.8 : 0.4
    }
  }

  return centroidScore * 0.7 + flatnessScore * 0.3
}

function scoreCalibratedHarmonicPattern(
  normalizedAmplitudes: number[],
  calibratedProfile: number[],
): number {
  let sumSquaredDiff = 0
  let count = 0

  for (let i = 0; i < Math.min(normalizedAmplitudes.length, calibratedProfile.length); i++) {
    const diff = normalizedAmplitudes[i] - calibratedProfile[i]
    sumSquaredDiff += diff * diff
    count++
  }

  if (count === 0) return 0.5

  const rmsDiff = Math.sqrt(sumSquaredDiff / count)
  return Math.exp(-rmsDiff * 2)
}

function scoreHarmonicPattern(
  normalizedAmplitudes: number[],
  candidate: StringCandidate,
  timeSinceOnsetMs?: number,
): number {
  const calibrated = getCalibratedProfile(candidate.stringNumber)
  if (calibrated && calibrated.sampleCount > 0) {
    const interpolatedProfile = getInterpolatedProfile(
      calibrated,
      candidate.fretNumber,
      timeSinceOnsetMs,
    )
    if (interpolatedProfile && interpolatedProfile.harmonicProfile.length > 0) {
      return scoreCalibratedHarmonicPattern(
        normalizedAmplitudes,
        interpolatedProfile.harmonicProfile,
      )
    }
  }

  const profile = getStringProfile(candidate.stringNumber)
  if (!profile) return 0.5

  let oddSum = 0
  let evenSum = 0
  for (let i = 0; i < normalizedAmplitudes.length; i++) {
    if ((i + 1) % 2 === 1) {
      oddSum += normalizedAmplitudes[i]
    } else {
      evenSum += normalizedAmplitudes[i]
    }
  }

  const oddEvenRatio = evenSum > 0 ? oddSum / evenSum : oddSum

  let higherHarmonicStrength = 0
  for (let i = 4; i < normalizedAmplitudes.length; i++) {
    higherHarmonicStrength += normalizedAmplitudes[i]
  }

  let score = 0.5

  if (profile.isWound) {
    if (higherHarmonicStrength < 1.5) {
      score += 0.2
    }
    if (oddEvenRatio < 2) {
      score += 0.1
    }
  } else {
    if (higherHarmonicStrength >= 1) {
      score += 0.2
    }
    if (oddEvenRatio >= 1.5) {
      score += 0.1
    }
  }

  return Math.min(1, score)
}

export function classifyString(
  pitch: number,
  measuredInharmonicity: number,
  spectralFeatures: SpectralFeatures,
  normalizedHarmonics: number[],
  timeSinceOnsetMs?: number,
): StringDetectionResult | null {
  const candidates = getCandidateStrings(pitch)

  if (candidates.length === 0) {
    return null
  }

  if (candidates.length === 1) {
    return {
      stringNumber: candidates[0].stringNumber,
      fretNumber: candidates[0].fretNumber,
      confidence: 0.95,
    }
  }

  const scores: CandidateScore[] = candidates.map((candidate) => {
    const inharmonicityScore = scoreInharmonicity(measuredInharmonicity, candidate, timeSinceOnsetMs)
    const spectralScore = scoreSpectralFeatures(spectralFeatures, candidate, timeSinceOnsetMs)
    const harmonicScore = scoreHarmonicPattern(normalizedHarmonics, candidate, timeSinceOnsetMs)

    const totalScore =
      inharmonicityScore * INHARMONICITY_WEIGHT +
      spectralScore * SPECTRAL_WEIGHT +
      harmonicScore * HARMONIC_WEIGHT

    return {
      candidate,
      inharmonicityScore,
      spectralScore,
      harmonicScore,
      totalScore,
    }
  })

  scores.sort((a, b) => b.totalScore - a.totalScore)

  const best = scores[0]
  const secondBest = scores.length > 1 ? scores[1] : null

  const scoreDifference = secondBest ? best.totalScore - secondBest.totalScore : 1
  const confidence = Math.min(0.95, 0.5 + scoreDifference * 2)

  const result: StringDetectionResult = {
    stringNumber: best.candidate.stringNumber,
    fretNumber: best.candidate.fretNumber,
    confidence,
  }

  if (secondBest && secondBest.totalScore > 0.3) {
    result.secondBest = {
      stringNumber: secondBest.candidate.stringNumber,
      fretNumber: secondBest.candidate.fretNumber,
      confidence: secondBest.totalScore,
    }
  }

  return result
}

export function getStringName(stringNumber: number): string {
  const profile = STANDARD_TUNING_STRINGS.find((s) => s.stringNumber === stringNumber)
  return profile?.name ?? `String ${stringNumber}`
}
