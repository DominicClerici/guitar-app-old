"use client"

import type { AttackFeatures } from "./attack-analysis"
import type {
  CalibratedStringProfile,
  FretProfile,
  GuitarCalibrationData,
  TemporalProfile,
} from "./calibration-types"
import type { SpectralFeatures, StringCandidate, StringDetectionResult } from "./guitar-constants"
import { getCandidateStrings, getStringProfile, STANDARD_TUNING_STRINGS } from "./guitar-constants"

const ATTACK_SUSTAIN_TRANSITION_START_MS = 100
const ATTACK_SUSTAIN_TRANSITION_END_MS = 200

export interface CandidateScore {
  candidate: StringCandidate
  inharmonicityScore: number
  spectralScore: number
  harmonicScore: number
  totalScore: number
}

interface PreFilterResult {
  candidate: StringCandidate
  preFilterScore: number
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

function isStringWound(stringNumber: number): boolean {
  const profile = getStringProfile(stringNumber)
  const defaultIsWound = profile?.isWound ?? false

  if (stringNumber === 3 && activeCalibration?.isGStringWound !== undefined) {
    return activeCalibration.isGStringWound
  }

  return defaultIsWound
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
    measuredInharmonicity: lower.measuredInharmonicity * (1 - t) + upper.measuredInharmonicity * t,
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
        measuredInharmonicity: upperTemp.measuredInharmonicity + slope.inharmonicity * extraFrets,
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

const BASE_INHARMONICITY_WEIGHT = 0.35
const BASE_SPECTRAL_WEIGHT = 0.1
const BASE_HARMONIC_WEIGHT = 0.55

function calculateDynamicWeights(spectralConfidence: number): {
  inharmonicityWeight: number
  spectralWeight: number
  harmonicWeight: number
} {
  const adjustedSpectralWeight = BASE_SPECTRAL_WEIGHT * spectralConfidence
  const remainingWeight = 1 - adjustedSpectralWeight
  const totalOtherBase = BASE_INHARMONICITY_WEIGHT + BASE_HARMONIC_WEIGHT

  return {
    inharmonicityWeight: (BASE_INHARMONICITY_WEIGHT / totalOtherBase) * remainingWeight,
    spectralWeight: adjustedSpectralWeight,
    harmonicWeight: (BASE_HARMONIC_WEIGHT / totalOtherBase) * remainingWeight,
  }
}

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

function getExpectedPitch(stringNumber: number, fretNumber: number): number {
  const stringProfile = STANDARD_TUNING_STRINGS.find((s) => s.stringNumber === stringNumber)
  if (!stringProfile) return 0
  return stringProfile.openFreq * Math.pow(2, fretNumber / 12)
}

function preFilterCandidates(
  candidates: StringCandidate[],
  detectedPitch: number,
  measuredInharmonicity: number,
  timeSinceOnsetMs?: number,
): PreFilterResult[] {
  return candidates.map((candidate) => {
    let preFilterScore = 1.0

    const expectedInharmonicity = calculateExpectedInharmonicity(
      candidate.stringNumber,
      candidate.fretNumber,
      timeSinceOnsetMs,
    )
    if (expectedInharmonicity > 0 && measuredInharmonicity > 0) {
      const inharmonicityRatio = measuredInharmonicity / expectedInharmonicity
      if (inharmonicityRatio > 3 || inharmonicityRatio < 0.33) {
        preFilterScore *= 0.5
      }
    }

    const expectedPitch = getExpectedPitch(candidate.stringNumber, candidate.fretNumber)
    if (expectedPitch > 0) {
      const centsDiff = Math.abs(1200 * Math.log2(detectedPitch / expectedPitch))
      if (centsDiff > 30) {
        preFilterScore *= 0.7
      } else if (centsDiff < 5) {
        preFilterScore *= 1.2
      }
    }

    return { candidate, preFilterScore }
  })
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

interface ExpectedCentroidResult {
  min: number
  max: number
  isCalibrated: boolean
  confidence: number
}

function getExpectedCentroidRange(
  stringNumber: number,
  fret: number,
  timeSinceOnsetMs?: number,
): ExpectedCentroidResult {
  const calibrated = getCalibratedProfile(stringNumber)
  if (calibrated && calibrated.sampleCount > 0) {
    const interpolatedProfile = getInterpolatedProfile(calibrated, fret, timeSinceOnsetMs)
    if (interpolatedProfile) {
      const rangeWidth =
        interpolatedProfile.spectralCentroidRange.max -
        interpolatedProfile.spectralCentroidRange.min
      const margin = Math.min(rangeWidth * 0.15, 150)
      const sampleConfidence = Math.min(1, calibrated.sampleCount / 10)
      return {
        min: interpolatedProfile.spectralCentroidRange.min - margin,
        max: interpolatedProfile.spectralCentroidRange.max + margin,
        isCalibrated: true,
        confidence: sampleConfidence,
      }
    }
  }

  const profile = getStringProfile(stringNumber)
  if (!profile) return { min: 0, max: 10000, isCalibrated: false, confidence: 0.3 }

  const fretAdjustment = fret * profile.centroidFretCoefficient
  return {
    min: profile.typicalCentroidRange.min + fretAdjustment,
    max: profile.typicalCentroidRange.max + fretAdjustment,
    isCalibrated: false,
    confidence: 0.5,
  }
}

interface SpectralScoreResult {
  score: number
  confidence: number
}

function scoreSpectralFeatures(
  features: SpectralFeatures,
  candidate: StringCandidate,
  timeSinceOnsetMs?: number,
): SpectralScoreResult {
  const centroidResult = getExpectedCentroidRange(
    candidate.stringNumber,
    candidate.fretNumber,
    timeSinceOnsetMs,
  )
  const profile = getStringProfile(candidate.stringNumber)

  let centroidScore = 0
  const rangeCenter = (centroidResult.min + centroidResult.max) / 2
  const rangeWidth = centroidResult.max - centroidResult.min

  if (features.centroid >= centroidResult.min && features.centroid <= centroidResult.max) {
    const normalizedDistance = Math.abs(features.centroid - rangeCenter) / (rangeWidth / 2)
    centroidScore = Math.exp(-normalizedDistance * normalizedDistance)
  } else {
    const distanceOutside =
      features.centroid < centroidResult.min
        ? centroidResult.min - features.centroid
        : features.centroid - centroidResult.max
    const penaltyFactor = centroidResult.isCalibrated ? 100 : 200
    centroidScore = Math.exp(-distanceOutside / penaltyFactor) * 0.5
  }

  let flatnessScore = 0.5
  if (profile) {
    const isWound = isStringWound(candidate.stringNumber)
    if (isWound) {
      if (features.flatness < 0.15) {
        flatnessScore = 0.9
      } else if (features.flatness < 0.25) {
        flatnessScore = 0.7
      } else if (features.flatness < 0.35) {
        flatnessScore = 0.5
      } else {
        flatnessScore = 0.3
      }
    } else {
      if (features.flatness >= 0.25) {
        flatnessScore = 0.85
      } else if (features.flatness >= 0.15) {
        flatnessScore = 0.7
      } else if (features.flatness >= 0.08) {
        flatnessScore = 0.5
      } else {
        flatnessScore = 0.35
      }
    }
  }

  let rolloffScore = 0.5
  if (profile) {
    const expectedRolloff = rangeCenter * 2
    const rolloffRatio = features.rolloff / expectedRolloff
    if (rolloffRatio >= 0.7 && rolloffRatio <= 1.5) {
      rolloffScore = 0.8
    } else if (rolloffRatio >= 0.5 && rolloffRatio <= 2.0) {
      rolloffScore = 0.6
    } else {
      rolloffScore = 0.4
    }
  }

  const baseScore = centroidScore * 0.6 + flatnessScore * 0.25 + rolloffScore * 0.15

  return {
    score: baseScore,
    confidence: centroidResult.confidence,
  }
}

function scoreCalibratedHarmonicPattern(
  normalizedAmplitudes: number[],
  calibratedProfile: number[],
): number {
  let weightedSumSquaredDiff = 0
  let totalWeight = 0

  const compareLength = Math.min(normalizedAmplitudes.length, calibratedProfile.length)
  for (let i = 0; i < compareLength; i++) {
    const harmonicNumber = i + 1
    const weight = 1 / harmonicNumber
    const diff = normalizedAmplitudes[i] - calibratedProfile[i]
    weightedSumSquaredDiff += weight * diff * diff
    totalWeight += weight
  }

  if (totalWeight === 0) return 0.5

  const weightedRmsDiff = Math.sqrt(weightedSumSquaredDiff / totalWeight)
  return Math.exp(-weightedRmsDiff * 2)
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

  if (!getStringProfile(candidate.stringNumber)) return 0.5

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

  if (isStringWound(candidate.stringNumber)) {
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
  _attackFeatures?: AttackFeatures,
): StringDetectionResult | null {
  const candidates = getCandidateStrings(pitch)

  if (candidates.length === 0) {
    return null
  }

  if (candidates.length === 1) {
    const candidate = candidates[0]
    const expectedInharmonicity = calculateExpectedInharmonicity(
      candidate.stringNumber,
      candidate.fretNumber,
      timeSinceOnsetMs,
    )
    return {
      stringNumber: candidate.stringNumber,
      fretNumber: candidate.fretNumber,
      confidence: 0.95,
      scoreDifference: 1,
      allCandidateScores: [
        {
          stringNumber: candidate.stringNumber,
          fretNumber: candidate.fretNumber,
          totalScore: 1,
          inharmonicityScore: 1,
          spectralScore: 1,
          harmonicScore: 1,
        },
      ],
      measuredInharmonicity,
      spectralCentroid: spectralFeatures.centroid,
      expectedInharmonicity,
    }
  }

  const preFilterResults = preFilterCandidates(
    candidates,
    pitch,
    measuredInharmonicity,
    timeSinceOnsetMs,
  )

  const preFilterMap = new Map<StringCandidate, number>()
  for (const result of preFilterResults) {
    preFilterMap.set(result.candidate, result.preFilterScore)
  }

  const spectralResults = candidates.map((candidate) =>
    scoreSpectralFeatures(spectralFeatures, candidate, timeSinceOnsetMs),
  )
  const avgSpectralConfidence =
    spectralResults.reduce((sum, r) => sum + r.confidence, 0) / spectralResults.length

  const weights = calculateDynamicWeights(avgSpectralConfidence)

  const scores: CandidateScore[] = candidates.map((candidate, idx) => {
    const inharmonicityScore = scoreInharmonicity(
      measuredInharmonicity,
      candidate,
      timeSinceOnsetMs,
    )
    const spectralResult = spectralResults[idx]
    const spectralScore = spectralResult.score
    const harmonicScore = scoreHarmonicPattern(normalizedHarmonics, candidate, timeSinceOnsetMs)

    const baseScore =
      inharmonicityScore * weights.inharmonicityWeight +
      spectralScore * weights.spectralWeight +
      harmonicScore * weights.harmonicWeight

    const preFilterScore = preFilterMap.get(candidate) ?? 1.0
    const totalScore = baseScore * preFilterScore

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

  const allCandidateScores = scores.map((s) => ({
    stringNumber: s.candidate.stringNumber,
    fretNumber: s.candidate.fretNumber,
    totalScore: s.totalScore,
    inharmonicityScore: s.inharmonicityScore,
    spectralScore: s.spectralScore,
    harmonicScore: s.harmonicScore,
  }))

  const expectedInharmonicity = calculateExpectedInharmonicity(
    best.candidate.stringNumber,
    best.candidate.fretNumber,
    timeSinceOnsetMs,
  )

  const result: StringDetectionResult = {
    stringNumber: best.candidate.stringNumber,
    fretNumber: best.candidate.fretNumber,
    confidence,
    scoreDifference,
    allCandidateScores,
    measuredInharmonicity,
    spectralCentroid: spectralFeatures.centroid,
    expectedInharmonicity,
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
