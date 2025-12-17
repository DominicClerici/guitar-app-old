/**
 * Chord Analysis Module
 *
 * Provides detailed breakdowns of chord structure including:
 * - Triad tones (root, 3rd, 5th)
 * - 6th/7th chord tones
 * - Natural and altered extensions (9th, 11th, 13th)
 * - Bass notes for slash chords
 * - Interval names in standard notation (1, b3, #5, maj7, b9, #11, etc.)
 */

// Note names for constructing analysis
const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const


/**
 * Chord tone category for organizing the analysis
 */
export type ChordToneCategory = "triad" | "seventh" | "extension" | "bass" | "altered"

/**
 * Represents a single tone in a chord with its analysis
 */
export interface ChordTone {
  /** The note name (e.g., "C", "F#", "Bb") */
  note: string
  /** Interval in semitones from the root */
  semitones: number
  /** Human-readable interval name (e.g., "root", "b3", "maj7", "#11") */
  intervalName: string
  /** Category of this tone in the chord structure */
  category: ChordToneCategory
  /** Scale degree (1-13) */
  degree: number
  /** Whether this is an altered tone (sharped or flatted from natural) */
  isAltered: boolean
  /** Description of the tone's function */
  function: string
}

/**
 * Complete chord analysis result
 */
export interface ChordAnalysis {
  /** The chord name (e.g., "Cmaj7", "G6/11", "Am7/G") */
  chordName: string
  /** Root note of the chord */
  root: string
  /** Quality/type of the chord */
  quality: string
  /** All tones organized by category */
  tones: {
    triad: ChordTone[]
    seventh: ChordTone | null
    extensions: ChordTone[]
    bass: ChordTone | null
  }
  /** Flat list of all tones for easy iteration */
  allTones: ChordTone[]
  /** Brief text summary of the chord structure */
  summary: string
  /** Detailed breakdown text */
  breakdown: string
}

/**
 * Input chord data for analysis (matches ChordResult from index.ts)
 */
export interface ChordForAnalysis {
  name: string
  root: string
  quality: string
  bassNote: string | null
  intervals: number[]
  isInversion: boolean
}

/**
 * Quality definitions with their expected intervals and tone functions
 */
interface QualityDefinition {
  intervals: number[]
  toneNames: string[]
  toneFunctions: string[]
  hasThird: boolean
  hasFifth: boolean
  seventhType: "none" | "major" | "minor" | "diminished"
}

const QUALITY_DEFINITIONS: Record<string, QualityDefinition> = {
  // Basic triads
  major: {
    intervals: [0, 4, 7],
    toneNames: ["1", "3", "5"],
    toneFunctions: ["root", "major third", "perfect fifth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },
  "": {
    intervals: [0, 4, 7],
    toneNames: ["1", "3", "5"],
    toneFunctions: ["root", "major third", "perfect fifth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },
  m: {
    intervals: [0, 3, 7],
    toneNames: ["1", "b3", "5"],
    toneFunctions: ["root", "minor third", "perfect fifth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },
  dim: {
    intervals: [0, 3, 6],
    toneNames: ["1", "b3", "b5"],
    toneFunctions: ["root", "minor third", "diminished fifth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },
  aug: {
    intervals: [0, 4, 8],
    toneNames: ["1", "3", "#5"],
    toneFunctions: ["root", "major third", "augmented fifth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },
  sus2: {
    intervals: [0, 2, 7],
    toneNames: ["1", "2", "5"],
    toneFunctions: ["root", "suspended 2nd", "perfect fifth"],
    hasThird: false,
    hasFifth: true,
    seventhType: "none",
  },
  sus4: {
    intervals: [0, 5, 7],
    toneNames: ["1", "4", "5"],
    toneFunctions: ["root", "suspended 4th", "perfect fifth"],
    hasThird: false,
    hasFifth: true,
    seventhType: "none",
  },
  "5": {
    intervals: [0, 7],
    toneNames: ["1", "5"],
    toneFunctions: ["root", "perfect fifth"],
    hasThird: false,
    hasFifth: true,
    seventhType: "none",
  },

  // Seventh chords
  maj7: {
    intervals: [0, 4, 7, 11],
    toneNames: ["1", "3", "5", "maj7"],
    toneFunctions: ["root", "major third", "perfect fifth", "major seventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "major",
  },
  "7": {
    intervals: [0, 4, 7, 10],
    toneNames: ["1", "3", "5", "b7"],
    toneFunctions: ["root", "major third", "perfect fifth", "minor seventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  m7: {
    intervals: [0, 3, 7, 10],
    toneNames: ["1", "b3", "5", "b7"],
    toneFunctions: ["root", "minor third", "perfect fifth", "minor seventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  mMaj7: {
    intervals: [0, 3, 7, 11],
    toneNames: ["1", "b3", "5", "maj7"],
    toneFunctions: ["root", "minor third", "perfect fifth", "major seventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "major",
  },
  dim7: {
    intervals: [0, 3, 6, 9],
    toneNames: ["1", "b3", "b5", "bb7"],
    toneFunctions: ["root", "minor third", "diminished fifth", "diminished seventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "diminished",
  },
  m7b5: {
    intervals: [0, 3, 6, 10],
    toneNames: ["1", "b3", "b5", "b7"],
    toneFunctions: ["root", "minor third", "diminished fifth", "minor seventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  aug7: {
    intervals: [0, 4, 8, 10],
    toneNames: ["1", "3", "#5", "b7"],
    toneFunctions: ["root", "major third", "augmented fifth", "minor seventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  augMaj7: {
    intervals: [0, 4, 8, 11],
    toneNames: ["1", "3", "#5", "maj7"],
    toneFunctions: ["root", "major third", "augmented fifth", "major seventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "major",
  },

  // Sixth chords
  "6": {
    intervals: [0, 4, 7, 9],
    toneNames: ["1", "3", "5", "6"],
    toneFunctions: ["root", "major third", "perfect fifth", "major sixth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },
  m6: {
    intervals: [0, 3, 7, 9],
    toneNames: ["1", "b3", "5", "6"],
    toneFunctions: ["root", "minor third", "perfect fifth", "major sixth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },

  // Sus chords with 7th
  "7sus4": {
    intervals: [0, 5, 7, 10],
    toneNames: ["1", "4", "5", "b7"],
    toneFunctions: ["root", "suspended 4th", "perfect fifth", "minor seventh"],
    hasThird: false,
    hasFifth: true,
    seventhType: "minor",
  },
  "7sus2": {
    intervals: [0, 2, 7, 10],
    toneNames: ["1", "2", "5", "b7"],
    toneFunctions: ["root", "suspended 2nd", "perfect fifth", "minor seventh"],
    hasThird: false,
    hasFifth: true,
    seventhType: "minor",
  },

  // Add chords
  add9: {
    intervals: [0, 4, 7, 14],
    toneNames: ["1", "3", "5", "9"],
    toneFunctions: ["root", "major third", "perfect fifth", "added ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },
  madd9: {
    intervals: [0, 3, 7, 14],
    toneNames: ["1", "b3", "5", "9"],
    toneFunctions: ["root", "minor third", "perfect fifth", "added ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },
  add11: {
    intervals: [0, 4, 7, 17],
    toneNames: ["1", "3", "5", "11"],
    toneFunctions: ["root", "major third", "perfect fifth", "added eleventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },
  add13: {
    intervals: [0, 4, 7, 21],
    toneNames: ["1", "3", "5", "13"],
    toneFunctions: ["root", "major third", "perfect fifth", "added thirteenth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },

  // Extended chords (9th, 11th, 13th)
  "9": {
    intervals: [0, 4, 7, 10, 14],
    toneNames: ["1", "3", "5", "b7", "9"],
    toneFunctions: ["root", "major third", "perfect fifth", "minor seventh", "ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  maj9: {
    intervals: [0, 4, 7, 11, 14],
    toneNames: ["1", "3", "5", "maj7", "9"],
    toneFunctions: ["root", "major third", "perfect fifth", "major seventh", "ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "major",
  },
  m9: {
    intervals: [0, 3, 7, 10, 14],
    toneNames: ["1", "b3", "5", "b7", "9"],
    toneFunctions: ["root", "minor third", "perfect fifth", "minor seventh", "ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  "11": {
    intervals: [0, 4, 7, 10, 14, 17],
    toneNames: ["1", "3", "5", "b7", "9", "11"],
    toneFunctions: ["root", "major third", "perfect fifth", "minor seventh", "ninth", "eleventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  maj11: {
    intervals: [0, 4, 7, 11, 14, 17],
    toneNames: ["1", "3", "5", "maj7", "9", "11"],
    toneFunctions: ["root", "major third", "perfect fifth", "major seventh", "ninth", "eleventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "major",
  },
  m11: {
    intervals: [0, 3, 7, 10, 14, 17],
    toneNames: ["1", "b3", "5", "b7", "9", "11"],
    toneFunctions: ["root", "minor third", "perfect fifth", "minor seventh", "ninth", "eleventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  "13": {
    intervals: [0, 4, 7, 10, 14, 17, 21],
    toneNames: ["1", "3", "5", "b7", "9", "11", "13"],
    toneFunctions: [
      "root",
      "major third",
      "perfect fifth",
      "minor seventh",
      "ninth",
      "eleventh",
      "thirteenth",
    ],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  maj13: {
    intervals: [0, 4, 7, 11, 14, 17, 21],
    toneNames: ["1", "3", "5", "maj7", "9", "11", "13"],
    toneFunctions: [
      "root",
      "major third",
      "perfect fifth",
      "major seventh",
      "ninth",
      "eleventh",
      "thirteenth",
    ],
    hasThird: true,
    hasFifth: true,
    seventhType: "major",
  },
  m13: {
    intervals: [0, 3, 7, 10, 14, 17, 21],
    toneNames: ["1", "b3", "5", "b7", "9", "11", "13"],
    toneFunctions: [
      "root",
      "minor third",
      "perfect fifth",
      "minor seventh",
      "ninth",
      "eleventh",
      "thirteenth",
    ],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },

  // 6/9 chords
  "6/9": {
    intervals: [0, 4, 7, 9, 14],
    toneNames: ["1", "3", "5", "6", "9"],
    toneFunctions: ["root", "major third", "perfect fifth", "major sixth", "ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },
  "m6/9": {
    intervals: [0, 3, 7, 9, 14],
    toneNames: ["1", "b3", "5", "6", "9"],
    toneFunctions: ["root", "minor third", "perfect fifth", "major sixth", "ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "none",
  },

  // Altered dominants
  "7b5": {
    intervals: [0, 4, 6, 10],
    toneNames: ["1", "3", "b5", "b7"],
    toneFunctions: ["root", "major third", "diminished fifth", "minor seventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  "7#5": {
    intervals: [0, 4, 8, 10],
    toneNames: ["1", "3", "#5", "b7"],
    toneFunctions: ["root", "major third", "augmented fifth", "minor seventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  "7b9": {
    intervals: [0, 4, 7, 10, 13],
    toneNames: ["1", "3", "5", "b7", "b9"],
    toneFunctions: ["root", "major third", "perfect fifth", "minor seventh", "flat ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  "7#9": {
    intervals: [0, 4, 7, 10, 15],
    toneNames: ["1", "3", "5", "b7", "#9"],
    toneFunctions: ["root", "major third", "perfect fifth", "minor seventh", "sharp ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  "7b5b9": {
    intervals: [0, 4, 6, 10, 13],
    toneNames: ["1", "3", "b5", "b7", "b9"],
    toneFunctions: ["root", "major third", "diminished fifth", "minor seventh", "flat ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  "7b5#9": {
    intervals: [0, 4, 6, 10, 15],
    toneNames: ["1", "3", "b5", "b7", "#9"],
    toneFunctions: ["root", "major third", "diminished fifth", "minor seventh", "sharp ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  "7#5b9": {
    intervals: [0, 4, 8, 10, 13],
    toneNames: ["1", "3", "#5", "b7", "b9"],
    toneFunctions: ["root", "major third", "augmented fifth", "minor seventh", "flat ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  "7#5#9": {
    intervals: [0, 4, 8, 10, 15],
    toneNames: ["1", "3", "#5", "b7", "#9"],
    toneFunctions: ["root", "major third", "augmented fifth", "minor seventh", "sharp ninth"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  "7#11": {
    intervals: [0, 4, 7, 10, 18],
    toneNames: ["1", "3", "5", "b7", "#11"],
    toneFunctions: ["root", "major third", "perfect fifth", "minor seventh", "sharp eleventh"],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
  "13b9": {
    intervals: [0, 4, 7, 10, 13, 21],
    toneNames: ["1", "3", "5", "b7", "b9", "13"],
    toneFunctions: [
      "root",
      "major third",
      "perfect fifth",
      "minor seventh",
      "flat ninth",
      "thirteenth",
    ],
    hasThird: true,
    hasFifth: true,
    seventhType: "minor",
  },
}

/**
 * Get note name at a specific interval from root
 */
function getNoteAtInterval(root: string, semitones: number, preferFlats: boolean): string {
  const notes = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP

  // Find root index
  let rootIndex = NOTE_NAMES_SHARP.indexOf(root as (typeof NOTE_NAMES_SHARP)[number])
  if (rootIndex === -1) {
    rootIndex = NOTE_NAMES_FLAT.indexOf(root as (typeof NOTE_NAMES_FLAT)[number])
  }
  if (rootIndex === -1) return root

  const targetIndex = ((rootIndex + semitones) % 12 + 12) % 12
  return notes[targetIndex] ?? root
}

/**
 * Determine if a root note traditionally uses flats
 */
function rootPrefersFlats(root: string): boolean {
  return ["F", "Bb", "Eb", "Ab", "Db", "Gb"].includes(root)
}

/**
 * Get the interval name for a given semitone distance
 */
function getIntervalName(semitones: number, context: "triad" | "seventh" | "extension"): string {
  const normalized = ((semitones % 12) + 12) % 12

  // Special cases based on context
  if (semitones === 0) return "1"

  // For extensions (9, 11, 13), use compound interval names
  if (context === "extension") {
    if (semitones === 14 || normalized === 2) return "9"
    if (semitones === 13 || normalized === 1) return "b9"
    if (semitones === 15 || normalized === 3) return "#9"
    if (semitones === 17 || normalized === 5) return "11"
    if (semitones === 18 || normalized === 6) return "#11"
    if (semitones === 21 || normalized === 9) return "13"
    if (semitones === 20 || normalized === 8) return "b13"
  }

  // Map normalized semitones to interval names
  const intervalMap: Record<number, string> = {
    0: "1",
    1: "b2",
    2: "2",
    3: "b3",
    4: "3",
    5: "4",
    6: "b5",
    7: "5",
    8: "#5",
    9: "6",
    10: "b7",
    11: "maj7",
  }

  return intervalMap[normalized] || String(semitones)
}

/**
 * Determine the category of a chord tone based on its interval
 */
function getToneCategory(semitones: number, hasSeventh: boolean): ChordToneCategory {
  const normalized = ((semitones % 12) + 12) % 12

  // Root, 3rd (major/minor), 5th (and altered 5ths) are triadic
  if (
    normalized === 0 ||
    normalized === 3 ||
    normalized === 4 ||
    normalized === 6 ||
    normalized === 7 ||
    normalized === 8
  ) {
    return "triad"
  }

  // Sus2 and Sus4 replace the 3rd in triads
  if (normalized === 2 || normalized === 5) {
    // Could be sus tone or extension
    if (semitones > 12) return "extension"
    return "triad"
  }

  // 6th is its own category (like 7th but no seventh present)
  if (normalized === 9 && !hasSeventh) return "seventh"

  // 7th (both major and minor)
  if (normalized === 10 || normalized === 11) return "seventh"

  // Everything else is an extension
  return "extension"
}

/**
 * Determine the scale degree from semitones
 */
function getScaleDegree(semitones: number): number {
  const normalized = ((semitones % 12) + 12) % 12
  const degreeMap: Record<number, number> = {
    0: 1,
    1: 2, // b2
    2: 2, // 2
    3: 3, // b3
    4: 3, // 3
    5: 4, // 4
    6: 5, // b5
    7: 5, // 5
    8: 5, // #5
    9: 6, // 6
    10: 7, // b7
    11: 7, // maj7
  }
  return degreeMap[normalized] || 1
}

/**
 * Check if an interval is altered (sharped or flatted from natural)
 */
function isAlteredInterval(_semitones: number, intervalName: string): boolean {
  return (
    intervalName.startsWith("b") ||
    intervalName.startsWith("#") ||
    intervalName === "dim7" ||
    intervalName.includes("bb")
  )
}

/**
 * Get a human-readable function description for an interval
 */
function getIntervalFunction(_semitones: number, intervalName: string): string {
  const functionMap: Record<string, string> = {
    "1": "root - the tonal center of the chord",
    "b2": "flat 2nd - creates dissonance, often used in Phrygian contexts",
    "2": "2nd/9th - adds color, common in sus2 and add9 chords",
    sus2: "suspended 2nd - replaces the 3rd, creates open sound",
    "b3": "minor 3rd - defines minor quality",
    m3: "minor 3rd - defines minor quality",
    "#9": "sharp 9th - creates the 'Hendrix chord' sound, very dissonant",
    "3": "major 3rd - defines major quality",
    M3: "major 3rd - defines major quality",
    "4": "4th/11th - suspension or extension",
    sus4: "suspended 4th - replaces the 3rd, creates tension",
    "11": "11th - extension that adds color",
    "#11": "sharp 11th - Lydian sound, very colorful in jazz",
    b5: "flat 5th - diminished quality, creates tension",
    "#4": "sharp 4th - same as #11, Lydian sound",
    "5": "perfect 5th - provides stability and fullness",
    P5: "perfect 5th - provides stability and fullness",
    "#5": "augmented 5th - creates tension and instability",
    b6: "flat 6th - same as #5, creates tension",
    b13: "flat 13th - altered extension, adds tension",
    "6": "major 6th - adds sweetness, common in jazz",
    "13": "13th - highest natural extension",
    dim7: "diminished 7th - creates strong pull to resolution",
    bb7: "diminished 7th - enharmonic to major 6th but functions differently",
    b7: "minor/dominant 7th - defines dominant and minor 7th quality",
    dom7: "dominant 7th - creates tension wanting to resolve",
    maj7: "major 7th - creates lush, dreamy quality",
    M7: "major 7th - creates lush, dreamy quality",
    "9": "9th - common extension, adds color",
    b9: "flat 9th - very tense, common in altered dominants",
  }

  return functionMap[intervalName] || `interval of ${_semitones} semitones`
}

/**
 * Analyze a chord and return detailed breakdown
 */
export function analyzeChord(chord: ChordForAnalysis): ChordAnalysis {
  const preferFlats = rootPrefersFlats(chord.root)
  const qualityDef = QUALITY_DEFINITIONS[chord.quality]

  const allTones: ChordTone[] = []
  const triadTones: ChordTone[] = []
  let seventhTone: ChordTone | null = null
  const extensionTones: ChordTone[] = []
  let bassTone: ChordTone | null = null

  // Determine if this chord has a 7th
  const hasSeventh =
    qualityDef?.seventhType !== "none" && qualityDef?.seventhType !== undefined

  // Process intervals from the chord
  const sortedIntervals = [...chord.intervals].sort((a, b) => a - b)

  for (const semitones of sortedIntervals) {
    const normalized = ((semitones % 12) + 12) % 12
    const category = getToneCategory(semitones, hasSeventh)
    const note = getNoteAtInterval(chord.root, semitones, preferFlats)

    // Get the interval name based on context and quality definition
    // Map category to valid context for getIntervalName
    const intervalContext: "triad" | "seventh" | "extension" =
      category === "bass" || category === "altered" ? "triad" : category
    let intervalName: string
    if (qualityDef) {
      const idx = qualityDef.intervals.findIndex(
        (i) => ((i % 12) + 12) % 12 === normalized
      )
      if (idx !== -1 && qualityDef.toneNames[idx]) {
        intervalName = qualityDef.toneNames[idx]
      } else {
        intervalName = getIntervalName(semitones, intervalContext)
      }
    } else {
      intervalName = getIntervalName(semitones, intervalContext)
    }

    const tone: ChordTone = {
      note,
      semitones,
      intervalName,
      category,
      degree: getScaleDegree(semitones),
      isAltered: isAlteredInterval(semitones, intervalName),
      function: getIntervalFunction(semitones, intervalName),
    }

    allTones.push(tone)

    // Categorize the tone
    if (category === "triad") {
      triadTones.push(tone)
    } else if (category === "seventh") {
      seventhTone = tone
    } else if (category === "extension") {
      extensionTones.push(tone)
    }
  }

  // Handle bass note for slash chords
  if (chord.bassNote && chord.isInversion) {
    // Find if the bass note is already in our tones
    const existingBassTone = allTones.find((t) => t.note === chord.bassNote)

    if (existingBassTone) {
      bassTone = { ...existingBassTone, category: "bass" }
    } else {
      // Calculate the interval for the bass note
      const rootIndex = NOTE_NAMES_SHARP.indexOf(chord.root as (typeof NOTE_NAMES_SHARP)[number])
      let bassIndex = NOTE_NAMES_SHARP.indexOf(chord.bassNote as (typeof NOTE_NAMES_SHARP)[number])
      if (bassIndex === -1) {
        bassIndex = NOTE_NAMES_FLAT.indexOf(chord.bassNote as (typeof NOTE_NAMES_FLAT)[number])
      }

      if (rootIndex !== -1 && bassIndex !== -1) {
        const bassSemitones = ((bassIndex - rootIndex) % 12 + 12) % 12
        const bassIntervalName = getIntervalName(bassSemitones, "triad")

        bassTone = {
          note: chord.bassNote,
          semitones: bassSemitones,
          intervalName: bassIntervalName,
          category: "bass",
          degree: getScaleDegree(bassSemitones),
          isAltered: isAlteredInterval(bassSemitones, bassIntervalName),
          function: `bass note - ${getIntervalFunction(bassSemitones, bassIntervalName)}`,
        }
      }
    }
  }

  // Generate summary
  const summary = generateSummary(chord, triadTones, seventhTone, extensionTones, bassTone)
  const breakdown = generateBreakdown(chord, triadTones, seventhTone, extensionTones, bassTone)

  return {
    chordName: chord.name,
    root: chord.root,
    quality: chord.quality || "major",
    tones: {
      triad: triadTones,
      seventh: seventhTone,
      extensions: extensionTones,
      bass: bassTone,
    },
    allTones,
    summary,
    breakdown,
  }
}

/**
 * Generate a brief text summary of the chord
 */
function generateSummary(
  chord: ChordForAnalysis,
  triad: ChordTone[],
  seventh: ChordTone | null,
  extensions: ChordTone[],
  bass: ChordTone | null
): string {
  const parts: string[] = []

  // Describe the triad
  const root = triad.find((t) => t.intervalName === "1")
  const third = triad.find((t) => ["3", "b3", "2", "4", "sus2", "sus4"].includes(t.intervalName))
  const fifth = triad.find((t) => ["5", "b5", "#5"].includes(t.intervalName))

  if (root) parts.push(`${root.note} root`)
  if (third) {
    if (third.intervalName === "b3" || third.intervalName === "m3") {
      parts.push(`${third.note} minor 3rd`)
    } else if (third.intervalName === "3" || third.intervalName === "M3") {
      parts.push(`${third.note} major 3rd`)
    } else if (third.intervalName === "2" || third.intervalName === "sus2") {
      parts.push(`${third.note} sus2`)
    } else if (third.intervalName === "4" || third.intervalName === "sus4") {
      parts.push(`${third.note} sus4`)
    }
  }
  if (fifth) {
    if (fifth.intervalName === "b5") {
      parts.push(`${fifth.note} diminished 5th`)
    } else if (fifth.intervalName === "#5") {
      parts.push(`${fifth.note} augmented 5th`)
    } else {
      parts.push(`${fifth.note} 5th`)
    }
  } else if (!fifth && triad.length > 0) {
    parts.push("(no 5th)")
  }

  // Describe the 7th
  if (seventh) {
    const seventhDesc =
      seventh.intervalName === "maj7"
        ? "major 7th"
        : seventh.intervalName === "b7"
          ? "minor 7th"
          : seventh.intervalName === "6"
            ? "6th"
            : seventh.intervalName === "bb7" || seventh.intervalName === "dim7"
              ? "diminished 7th"
              : "7th"
    parts.push(`${seventh.note} ${seventhDesc}`)
  }

  // Describe extensions
  for (const ext of extensions) {
    const extDesc = ext.isAltered
      ? `${ext.note} ${ext.intervalName} (altered)`
      : `${ext.note} ${ext.intervalName}`
    parts.push(extDesc)
  }

  // Describe bass
  if (bass && bass.note !== chord.root) {
    parts.push(`/${bass.note} in bass`)
  }

  return parts.join(", ")
}

/**
 * Generate a detailed breakdown of the chord
 */
function generateBreakdown(
  chord: ChordForAnalysis,
  triad: ChordTone[],
  seventh: ChordTone | null,
  extensions: ChordTone[],
  bass: ChordTone | null
): string {
  const lines: string[] = []

  lines.push(`=== ${chord.name} Analysis ===`)
  lines.push("")

  // Triad section
  lines.push("TRIAD:")
  for (const tone of triad) {
    lines.push(`  ${tone.note} (${tone.intervalName}) - ${tone.function}`)
  }

  // Check for missing triad tones
  const hasRoot = triad.some((t) => t.intervalName === "1")
  const hasThird = triad.some((t) =>
    ["3", "b3", "M3", "m3", "2", "4", "sus2", "sus4"].includes(t.intervalName)
  )
  const hasFifth = triad.some((t) => ["5", "b5", "#5", "P5"].includes(t.intervalName))

  if (!hasRoot) lines.push("  (root omitted)")
  if (!hasThird) lines.push("  (no 3rd - ambiguous major/minor)")
  if (!hasFifth) lines.push("  (5th omitted - common in voicings)")

  // Seventh section
  if (seventh) {
    lines.push("")
    lines.push("SEVENTH:")
    lines.push(`  ${seventh.note} (${seventh.intervalName}) - ${seventh.function}`)
  }

  // Extensions section
  if (extensions.length > 0) {
    lines.push("")
    lines.push("EXTENSIONS:")
    for (const ext of extensions) {
      const alteredNote = ext.isAltered ? " [ALTERED]" : ""
      lines.push(`  ${ext.note} (${ext.intervalName})${alteredNote} - ${ext.function}`)
    }
  }

  // Bass note section
  if (bass && bass.note !== chord.root) {
    lines.push("")
    lines.push("BASS NOTE:")
    lines.push(`  ${bass.note} (${bass.intervalName}) - creates slash chord voicing`)
  }

  return lines.join("\n")
}

/**
 * Analyze multiple chord interpretations and compare them
 */
export function analyzeChordInterpretations(chords: ChordForAnalysis[]): {
  analyses: ChordAnalysis[]
  comparison: string
} {
  const analyses = chords.map(analyzeChord)

  // Generate comparison text
  const comparisonLines: string[] = []
  comparisonLines.push("=== Chord Interpretation Comparison ===")
  comparisonLines.push("")

  for (const analysis of analyses) {
    comparisonLines.push(`${analysis.chordName}:`)
    comparisonLines.push(`  ${analysis.summary}`)
    comparisonLines.push("")
  }

  if (analyses.length > 1) {
    comparisonLines.push("Note: These are different interpretations of the same notes.")
    comparisonLines.push("The correct name depends on harmonic context and function.")
  }

  return {
    analyses,
    comparison: comparisonLines.join("\n"),
  }
}

