"use client"

export interface StringProfile {
  stringNumber: number
  name: string
  openMidi: number
  openFreq: number
  maxFret: number
  minFreq: number
  maxFreq: number
  typicalInharmonicity: number
  isWound: boolean
}

export interface StringCandidate {
  stringNumber: number
  fretNumber: number
  expectedFreq: number
}

export interface HarmonicPeak {
  harmonicNumber: number
  expectedFreq: number
  actualFreq: number
  amplitude: number
  deviationCents: number
}

export interface SpectralFeatures {
  centroid: number
  rolloff: number
  spread: number
  flatness: number
}

export interface StringDetectionResult {
  stringNumber: number
  fretNumber: number
  confidence: number
  secondBest?: {
    stringNumber: number
    fretNumber: number
    confidence: number
  }
}

export const STANDARD_TUNING_STRINGS: StringProfile[] = [
  {
    stringNumber: 6,
    name: "Low E",
    openMidi: 40,
    openFreq: 82.41,
    maxFret: 24,
    minFreq: 82.41,
    maxFreq: 329.63,
    typicalInharmonicity: 0.00012,
    isWound: true,
  },
  {
    stringNumber: 5,
    name: "A",
    openMidi: 45,
    openFreq: 110.0,
    maxFret: 24,
    minFreq: 110.0,
    maxFreq: 440.0,
    typicalInharmonicity: 0.00008,
    isWound: true,
  },
  {
    stringNumber: 4,
    name: "D",
    openMidi: 50,
    openFreq: 146.83,
    maxFret: 24,
    minFreq: 146.83,
    maxFreq: 587.33,
    typicalInharmonicity: 0.00005,
    isWound: true,
  },
  {
    stringNumber: 3,
    name: "G",
    openMidi: 55,
    openFreq: 196.0,
    maxFret: 24,
    minFreq: 196.0,
    maxFreq: 783.99,
    typicalInharmonicity: 0.00003,
    isWound: false,
  },
  {
    stringNumber: 2,
    name: "B",
    openMidi: 59,
    openFreq: 246.94,
    maxFret: 24,
    minFreq: 246.94,
    maxFreq: 987.77,
    typicalInharmonicity: 0.00002,
    isWound: false,
  },
  {
    stringNumber: 1,
    name: "High E",
    openMidi: 64,
    openFreq: 329.63,
    maxFret: 24,
    minFreq: 329.63,
    maxFreq: 1318.51,
    typicalInharmonicity: 0.00001,
    isWound: false,
  },
]

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69
}

export function getCandidateStrings(pitch: number): StringCandidate[] {
  const candidates: StringCandidate[] = []
  const midiNote = freqToMidi(pitch)
  const roundedMidi = Math.round(midiNote)

  for (const string of STANDARD_TUNING_STRINGS) {
    const fret = roundedMidi - string.openMidi
    if (fret >= 0 && fret <= string.maxFret) {
      candidates.push({
        stringNumber: string.stringNumber,
        fretNumber: fret,
        expectedFreq: midiToFreq(string.openMidi + fret),
      })
    }
  }

  return candidates
}

export function getStringProfile(stringNumber: number): StringProfile | undefined {
  return STANDARD_TUNING_STRINGS.find((s) => s.stringNumber === stringNumber)
}
