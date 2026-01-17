"use client"

import type {
  CalibrationValidationResult,
  CalibrationWarning,
  GuitarCalibrationData,
} from "./calibration-types"

const MIN_RECOMMENDED_SAMPLES = 5
const HIGH_VARIANCE_THRESHOLD = 3000
const INHARMONICITY_OUTLIER_THRESHOLD = 3

export function validateCalibrationData(data: GuitarCalibrationData): CalibrationValidationResult {
  const warnings: CalibrationWarning[] = []

  checkMissingData(data, warnings)
  checkInharmonicityOrder(data, warnings)
  checkCentroidOrder(data, warnings)
  checkHighVariance(data, warnings)

  const overallQuality = determineOverallQuality(warnings)
  const isValid = !warnings.some((w) => w.severity === "error")

  return {
    isValid,
    overallQuality,
    warnings,
  }
}

function checkMissingData(data: GuitarCalibrationData, warnings: CalibrationWarning[]): void {
  const missingStrings: number[] = []
  const lowSampleStrings: number[] = []

  for (const stringProfile of data.strings) {
    if (stringProfile.sampleCount === 0) {
      missingStrings.push(stringProfile.stringNumber)
    } else if (stringProfile.sampleCount < MIN_RECOMMENDED_SAMPLES) {
      lowSampleStrings.push(stringProfile.stringNumber)
    }
  }

  if (missingStrings.length > 0) {
    warnings.push({
      type: "missing_data",
      severity: "error",
      message: `No calibration data collected for string${missingStrings.length > 1 ? "s" : ""} ${missingStrings.join(", ")}`,
      affectedStrings: missingStrings,
    })
  }

  if (lowSampleStrings.length > 0) {
    warnings.push({
      type: "missing_data",
      severity: "warning",
      message: `Low sample count for string${lowSampleStrings.length > 1 ? "s" : ""} ${lowSampleStrings.join(", ")} (fewer than ${MIN_RECOMMENDED_SAMPLES} samples)`,
      affectedStrings: lowSampleStrings,
    })
  }
}

function checkInharmonicityOrder(
  data: GuitarCalibrationData,
  warnings: CalibrationWarning[],
): void {
  const stringsWithData = data.strings.filter(
    (s) => s.sampleCount > 0 && s.attackProfile.measuredInharmonicity > 0,
  )

  if (stringsWithData.length < 3) return

  const inharmonicities = stringsWithData.map((s) => s.attackProfile.measuredInharmonicity)
  const median = getMedian(inharmonicities)
  const mad = getMedianAbsoluteDeviation(inharmonicities, median)

  if (mad === 0) return

  const outlierStrings: number[] = []
  for (const s of stringsWithData) {
    const deviation = Math.abs(s.attackProfile.measuredInharmonicity - median) / mad
    if (deviation > INHARMONICITY_OUTLIER_THRESHOLD) {
      outlierStrings.push(s.stringNumber)
    }
  }

  if (outlierStrings.length > 0) {
    warnings.push({
      type: "inharmonicity_order",
      severity: "info",
      message: `Unusual inharmonicity values detected for string${outlierStrings.length > 1 ? "s" : ""} ${outlierStrings.join(", ")}. Consider recalibrating these strings.`,
      affectedStrings: outlierStrings,
    })
  }
}

function getMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function getMedianAbsoluteDeviation(values: number[], median: number): number {
  const absoluteDeviations = values.map((v) => Math.abs(v - median))
  return getMedian(absoluteDeviations)
}

function checkCentroidOrder(data: GuitarCalibrationData, warnings: CalibrationWarning[]): void {
  const woundStrings = data.strings.filter(
    (s) => [6, 5, 4].includes(s.stringNumber) && s.sampleCount > 0,
  )
  const unwoundStrings = data.strings.filter(
    (s) => [3, 2, 1].includes(s.stringNumber) && s.sampleCount > 0,
  )

  if (woundStrings.length === 0 || unwoundStrings.length === 0) return

  const avgWoundCentroid =
    woundStrings.reduce((sum, s) => {
      const range = s.attackProfile.spectralCentroidRange
      return sum + (range.min + range.max) / 2
    }, 0) / woundStrings.length

  const avgUnwoundCentroid =
    unwoundStrings.reduce((sum, s) => {
      const range = s.attackProfile.spectralCentroidRange
      return sum + (range.min + range.max) / 2
    }, 0) / unwoundStrings.length

  if (avgUnwoundCentroid < avgWoundCentroid) {
    const affectedStrings = [
      ...woundStrings.map((s) => s.stringNumber),
      ...unwoundStrings.map((s) => s.stringNumber),
    ]

    warnings.push({
      type: "centroid_order",
      severity: "warning",
      message: `Unexpected spectral pattern: unwound strings (1-3) have lower brightness than wound strings (4-6). This may indicate calibration issues.`,
      affectedStrings,
    })
  }
}

function checkHighVariance(data: GuitarCalibrationData, warnings: CalibrationWarning[]): void {
  const highVarianceStrings: number[] = []

  for (const stringProfile of data.strings) {
    if (stringProfile.sampleCount === 0) continue

    const range = stringProfile.attackProfile.spectralCentroidRange
    const variance = range.max - range.min

    if (variance > HIGH_VARIANCE_THRESHOLD) {
      highVarianceStrings.push(stringProfile.stringNumber)
    }
  }

  if (highVarianceStrings.length > 0) {
    warnings.push({
      type: "high_variance",
      severity: "info",
      message: `High variance in spectral data for string${highVarianceStrings.length > 1 ? "s" : ""} ${highVarianceStrings.join(", ")}. Consider recalibrating with more consistent playing.`,
      affectedStrings: highVarianceStrings,
    })
  }
}

function determineOverallQuality(warnings: CalibrationWarning[]): "good" | "acceptable" | "poor" {
  const hasError = warnings.some((w) => w.severity === "error")
  const warningCount = warnings.filter((w) => w.severity === "warning").length

  if (hasError) return "poor"
  if (warningCount >= 2) return "acceptable"
  return "good"
}
