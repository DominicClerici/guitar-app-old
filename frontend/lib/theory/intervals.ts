export type Interval = {
  semitones: number
  name: string
  shortName: string
  degree: number
}

export const INTERVALS: Record<number, Interval> = {
  0: { semitones: 0, name: "P1", shortName: "R", degree: 1 },
  1: { semitones: 1, name: "m2", shortName: "b2", degree: 2 },
  2: { semitones: 2, name: "M2", shortName: "2", degree: 2 },
  3: { semitones: 3, name: "m3", shortName: "b3", degree: 3 },
  4: { semitones: 4, name: "M3", shortName: "3", degree: 3 },
  5: { semitones: 5, name: "P4", shortName: "4", degree: 4 },
  6: { semitones: 6, name: "TT", shortName: "b5", degree: 5 },
  7: { semitones: 7, name: "P5", shortName: "5", degree: 5 },
  8: { semitones: 8, name: "m6", shortName: "b6", degree: 6 },
  9: { semitones: 9, name: "M6", shortName: "6", degree: 6 },
  10: { semitones: 10, name: "m7", shortName: "b7", degree: 7 },
  11: { semitones: 11, name: "M7", shortName: "7", degree: 7 },
}

export function getIntervalName(semitones: number): string {
  return INTERVALS[semitones % 12]?.shortName ?? String(semitones)
}

export function getIntervalFromSemitones(semitones: number): Interval | undefined {
  return INTERVALS[semitones % 12]
}
