const SCALE_NAMES = {
  major: "Major",
  minor: "Minor",
  minorPentatonic: "Minor Pentatonic",
  majorPentatonic: "Major Pentatonic",
  dorian: "Dorian",
  phrygian: "Phrygian",
  lydian: "Lydian",
  mixolydian: "Mixolydian",
  aeolian: "Aeolian",
  locrian: "Locrian",
}

export type ScaleType = keyof typeof SCALE_NAMES

export { SCALE_NAMES }
