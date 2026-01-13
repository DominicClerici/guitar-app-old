"use client"

export interface TemporalProfile {
  measuredInharmonicity: number
  spectralCentroidRange: { min: number; max: number }
  harmonicProfile: number[]
}

export interface FretProfile {
  fret: number
  attackProfile: TemporalProfile
  sustainProfile: TemporalProfile
  sampleCount: number
}

export interface CalibratedStringProfile {
  stringNumber: number
  attackProfile: TemporalProfile
  sustainProfile: TemporalProfile
  sampleCount: number
  calibratedAt: number
  fretProfiles?: FretProfile[]
}

export interface GuitarCalibrationData {
  id: string
  name: string
  strings: CalibratedStringProfile[]
  createdAt: number
  updatedAt: number
}

export type CalibrationPhase = "open" | "fret5" | "fret12"

export type CalibrationStep =
  | { type: "idle" }
  | { type: "listening"; stringNumber: number; fret: number; attackSamples: number; sustainSamples: number }
  | { type: "complete"; stringNumber: number; fret: number }
  | { type: "phase-complete"; phase: CalibrationPhase }
  | { type: "error"; message: string }
