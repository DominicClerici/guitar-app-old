import { midiToFreq, STRING_OPEN_MIDI } from "./utils"

export interface StringInfo {
  number: number // 1-6 (1 = high E, 6 = low E)
  name: string
  openMidi: number
  openFreq: number
  material: "plain" | "wound"
  gauge: number // approximate in thousandths of inch (e.g., 10 = .010")
}

export interface FrequencyRange {
  min: number
  max: number
}

const MAX_FRETS = 22

export const STRINGS: StringInfo[] = [
  {
    number: 1,
    name: "E4",
    openMidi: STRING_OPEN_MIDI[5],
    openFreq: midiToFreq(STRING_OPEN_MIDI[5]),
    material: "plain",
    gauge: 10,
  },
  {
    number: 2,
    name: "B3",
    openMidi: STRING_OPEN_MIDI[4],
    openFreq: midiToFreq(STRING_OPEN_MIDI[4]),
    material: "plain",
    gauge: 13,
  },
  {
    number: 3,
    name: "G3",
    openMidi: STRING_OPEN_MIDI[3],
    openFreq: midiToFreq(STRING_OPEN_MIDI[3]),
    material: "plain",
    gauge: 17,
  },
  {
    number: 4,
    name: "D3",
    openMidi: STRING_OPEN_MIDI[2],
    openFreq: midiToFreq(STRING_OPEN_MIDI[2]),
    material: "wound",
    gauge: 26,
  },
  {
    number: 5,
    name: "A2",
    openMidi: STRING_OPEN_MIDI[1],
    openFreq: midiToFreq(STRING_OPEN_MIDI[1]),
    material: "wound",
    gauge: 36,
  },
  {
    number: 6,
    name: "E2",
    openMidi: STRING_OPEN_MIDI[0],
    openFreq: midiToFreq(STRING_OPEN_MIDI[0]),
    material: "wound",
    gauge: 46,
  },
]

export function getStringByNumber(stringNumber: number): StringInfo | undefined {
  return STRINGS.find((s) => s.number === stringNumber)
}

export function getFretFrequency(stringNumber: number, fret: number): number {
  const string = getStringByNumber(stringNumber)
  if (!string) {
    throw new Error(`Invalid string number: ${stringNumber}`)
  }
  if (fret < 0) {
    throw new Error(`Fret must be non-negative: ${fret}`)
  }
  return midiToFreq(string.openMidi + fret)
}

export function getStringFrequencyRange(stringNumber: number): FrequencyRange {
  const string = getStringByNumber(stringNumber)
  if (!string) {
    throw new Error(`Invalid string number: ${stringNumber}`)
  }
  return {
    min: string.openFreq,
    max: midiToFreq(string.openMidi + MAX_FRETS),
  }
}

export function getCandidateStrings(frequency: number, toleranceCents = 50): number[] {
  const candidates: number[] = []

  for (const string of STRINGS) {
    const range = getStringFrequencyRange(string.number)

    const toleranceMultiplier = Math.pow(2, toleranceCents / 1200)
    const minWithTolerance = range.min / toleranceMultiplier
    const maxWithTolerance = range.max * toleranceMultiplier

    if (frequency >= minWithTolerance && frequency <= maxWithTolerance) {
      candidates.push(string.number)
    }
  }

  return candidates.sort((a, b) => a - b)
}

export function getFretForFrequency(
  stringNumber: number,
  frequency: number
): { fret: number; centsOff: number } | null {
  const string = getStringByNumber(stringNumber)
  if (!string) return null

  const semitonesFromOpen = 12 * Math.log2(frequency / string.openFreq)
  const fret = Math.round(semitonesFromOpen)

  if (fret < 0 || fret > MAX_FRETS) return null

  const exactFreq = getFretFrequency(stringNumber, fret)
  const centsOff = 1200 * Math.log2(frequency / exactFreq)

  return { fret, centsOff }
}

export function isWoundString(stringNumber: number): boolean {
  const string = getStringByNumber(stringNumber)
  return string?.material === "wound"
}
