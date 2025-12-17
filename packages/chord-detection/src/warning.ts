// Core chord data needed for warning generation (avoids circular dependency)
export interface ChordData {
  name: string
  root: string
  quality: string
  bassNote: string | null
  intervals: number[]
  isInversion: boolean
}

export interface ChordWarning {
  type: ChordWarningType
  message: string
  details?: string
  alternativeInterpretation?: string
}

export type ChordWarningType =
  | "enharmonic_equivalence" // Same notes, different chord name
  | "ambiguous_quality" // Could be major or minor depending on context
  | "missing_third" // No 3rd makes major/minor ambiguous
  | "missing_fifth" // Common but worth noting in some contexts
  | "unusual_voicing" // Non-standard interval arrangement
  | "theoretical_chord" // Rarely used in practice
  | "consider_simpler" // A simpler chord interpretation exists

/**
 * Chord equivalences: when certain chord types share the same pitch classes
 * Format: [chordQuality, equivalentQuality, rootIntervalDifference, condition]
 *
 * For example: m7 starting on the 3rd = 6 chord
 * Am7 (A C E G) = C6 (C E G A) - root is 3 semitones up
 */
interface ChordEquivalence {
  sourceQuality: string
  targetQuality: string
  rootInterval: number // Semitones from source root to equivalent root
  description: string
  condition?: "with_fifth" | "without_fifth"
}

const CHORD_EQUIVALENCES: ChordEquivalence[] = [
  // Minor 7th = Major 6th (from the b3)
  {
    sourceQuality: "m7",
    targetQuality: "6",
    rootInterval: 3,
    description: "A minor 7th chord contains the same notes as a major 6th chord built on its minor 3rd",
  },
  // Major 6th = Minor 7th (from the 6th)
  {
    sourceQuality: "6",
    targetQuality: "m7",
    rootInterval: 9,
    description: "A major 6th chord contains the same notes as a minor 7th chord built on its 6th",
  },
  // Diminished 7th - all inversions are equivalent (symmetrical chord)
  {
    sourceQuality: "dim7",
    targetQuality: "dim7",
    rootInterval: 3,
    description: "Diminished 7th chords are symmetrical - each inversion can be seen as a different dim7 chord",
  },
  // m7b5 = m6 (from the b3)
  {
    sourceQuality: "m7b5",
    targetQuality: "m6",
    rootInterval: 3,
    description: "A half-diminished chord contains the same notes as a minor 6th chord built on its minor 3rd",
  },
  // Minor 6th = m7b5 (from the 6th)
  {
    sourceQuality: "m6",
    targetQuality: "m7b5",
    rootInterval: 9,
    description: "A minor 6th chord contains the same notes as a half-diminished chord built on its 6th",
  },
  // Augmented - symmetrical (every major 3rd)
  {
    sourceQuality: "aug",
    targetQuality: "aug",
    rootInterval: 4,
    description: "Augmented triads are symmetrical - each note can be considered the root",
  },
  // 6/9 = 6/9 from the 5th (pentatonic relationship)
  {
    sourceQuality: "6/9",
    targetQuality: "m7/11",
    rootInterval: 9,
    description: "A 6/9 chord shares notes with an m7/11 chord built on its 6th",
  },
  // add9 = add4 from the 5th
  {
    sourceQuality: "add9",
    targetQuality: "sus4",
    rootInterval: 7,
    description: "An add9 chord without the 5th contains similar tones to a sus4 chord",
    condition: "without_fifth",
  },
]

/**
 * Chords that are theoretically valid but rarely used in practice
 */
const THEORETICAL_CHORDS: Record<string, string> = {
  augMaj7: "Augmented major 7th chords are rare and have a very dissonant, unstable sound",
  "7b5b9": "This altered dominant is very dissonant and typically only used in jazz contexts",
  "7#5#9": 'The "Hendrix chord" variant - very dissonant, use sparingly',
  dim7: "In modern music, diminished 7th is often replaced with m7b5 or dominant 7b9",
}

/**
 * Qualities that indicate a power chord (no 3rd)
 */
const POWER_CHORD_QUALITIES = ["5"]

/**
 * Check if a chord is missing its defining third
 */
function isMissingThird(intervals: number[]): boolean {
  // A chord needs either a major 3rd (4 semitones) or minor 3rd (3 semitones)
  const hasThird = intervals.includes(3) || intervals.includes(4)
  return !hasThird
}


/**
 * Get the note name at a given interval from the root
 */
function getNoteAtInterval(root: string, interval: number, preferFlats: boolean = false): string {
  const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
  const NOTES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

  const notes = preferFlats ? NOTES_FLAT : NOTES_SHARP

  // Find the root's position
  let rootIndex = NOTES_SHARP.indexOf(root)
  if (rootIndex === -1) {
    rootIndex = NOTES_FLAT.indexOf(root)
  }
  if (rootIndex === -1) {
    return root // Fallback
  }

  const targetIndex = (rootIndex + interval) % 12
  return notes[targetIndex]!
}

/**
 * Check if the root note typically uses flats
 */
function rootPrefersFlats(root: string): boolean {
  return ["F", "Bb", "Eb", "Ab", "Db", "Gb"].includes(root)
}

/**
 * Generate warnings for a single chord result
 */
export function generateChordWarnings(
  chord: ChordData,
  allResults: ChordData[],
): ChordWarning[] {
  const warnings: ChordWarning[] = []
  const preferFlats = rootPrefersFlats(chord.root)

  // 1. Check for enharmonic equivalences
  for (const equivalence of CHORD_EQUIVALENCES) {
    if (chord.quality === equivalence.sourceQuality ||
        (chord.quality === "major" && equivalence.sourceQuality === "")) {
      const actualQuality = chord.quality === "major" ? "" : chord.quality
      if (actualQuality === equivalence.sourceQuality) {
        const equivalentRoot = getNoteAtInterval(chord.root, equivalence.rootInterval, preferFlats)
        const equivalentChordName = `${equivalentRoot}${equivalence.targetQuality}`

        // Check if this equivalent chord is in our results
        const hasEquivalent = allResults.some(
          (r) => r.root === equivalentRoot &&
                 (r.quality === equivalence.targetQuality ||
                  (r.quality === "major" && equivalence.targetQuality === ""))
        )

        if (hasEquivalent) {
          warnings.push({
            type: "enharmonic_equivalence",
            message: `This chord is enharmonically equivalent to ${equivalentChordName}`,
            details: equivalence.description,
            alternativeInterpretation: equivalentChordName,
          })
        }
      }
    }
  }

  // 2. Check for missing third (ambiguous major/minor)
  if (isMissingThird(chord.intervals) && !POWER_CHORD_QUALITIES.includes(chord.quality)) {
    warnings.push({
      type: "missing_third",
      message: "This chord has no 3rd - major/minor quality is ambiguous",
      details:
        "Without a 3rd, this chord could function as either major or minor depending on musical context. " +
        "This is common in rock/metal (power chords) but unusual for other chord types.",
    })
  }

  // 3. Check for theoretical/rare chords
  const theoreticalDetails = THEORETICAL_CHORDS[chord.quality]
  if (theoreticalDetails) {
    warnings.push({
      type: "theoretical_chord",
      message: "This is a rarely-used chord type",
      details: theoreticalDetails,
    })
  }

  // 4. Check if a simpler interpretation exists
  // If this chord is an inversion and a simpler chord exists in results
  if (chord.isInversion) {
    const simplerChord = allResults.find(
      (r) =>
        !r.isInversion &&
        r.name !== chord.name &&
        getChordComplexity(r.quality) < getChordComplexity(chord.quality)
    )

    if (simplerChord) {
      warnings.push({
        type: "consider_simpler",
        message: `Consider the simpler interpretation: ${simplerChord.name}`,
        details: `This inversion (${chord.name}) could also be analyzed as ${simplerChord.name}, which may be easier to read and communicate.`,
        alternativeInterpretation: simplerChord.name,
      })
    }
  }

  // 5. Check for sus chords that might be incomplete voicings
  if (chord.quality === "sus2" || chord.quality === "sus4") {
    warnings.push({
      type: "ambiguous_quality",
      message: "Sus chords are inherently ambiguous",
      details:
        `A ${chord.quality} chord suspends the 3rd, creating tension that typically resolves. ` +
        "Without resolution context, this could be an incomplete voicing of a different chord.",
    })
  }

  // 6. Symmetrical chord warnings
  if (chord.quality === "dim7") {
    warnings.push({
      type: "enharmonic_equivalence",
      message: "Diminished 7th chords are symmetrical",
      details:
        "Every diminished 7th chord has 4 possible root interpretations (every minor 3rd). " +
        `This ${chord.name} could also be ${getSymmetricalDim7Names(chord.root, preferFlats).join(", ")}.`,
    })
  }

  if (chord.quality === "aug") {
    warnings.push({
      type: "enharmonic_equivalence",
      message: "Augmented triads are symmetrical",
      details:
        "Every augmented triad has 3 possible root interpretations (every major 3rd). " +
        `This ${chord.name} could also be ${getSymmetricalAugNames(chord.root, preferFlats).join(", ")}.`,
    })
  }

  return warnings
}

/**
 * Get complexity score for a chord quality (lower = simpler)
 */
function getChordComplexity(quality: string): number {
  const complexityMap: Record<string, number> = {
    "": 1,
    major: 1,
    m: 1,
    "5": 1,
    sus2: 2,
    sus4: 2,
    dim: 2,
    aug: 2,
    "6": 3,
    m6: 3,
    "7": 3,
    maj7: 3,
    m7: 3,
    dim7: 4,
    m7b5: 4,
    add9: 4,
    "9": 5,
    maj9: 5,
    m9: 5,
    "6/9": 5,
    "11": 6,
    "13": 7,
  }
  return complexityMap[quality] ?? 5
}

/**
 * Get all enharmonic names for a diminished 7th chord
 */
function getSymmetricalDim7Names(root: string, preferFlats: boolean): string[] {
  const names: string[] = []
  // Diminished 7th repeats every 3 semitones
  for (const interval of [3, 6, 9]) {
    const altRoot = getNoteAtInterval(root, interval, preferFlats)
    names.push(`${altRoot}dim7`)
  }
  return names
}

/**
 * Get all enharmonic names for an augmented triad
 */
function getSymmetricalAugNames(root: string, preferFlats: boolean): string[] {
  const names: string[] = []
  // Augmented repeats every 4 semitones
  for (const interval of [4, 8]) {
    const altRoot = getNoteAtInterval(root, interval, preferFlats)
    names.push(`${altRoot}aug`)
  }
  return names
}

/**
 * Process all chord results and add warnings to each
 */
export function addWarningsToChords(
  chords: ChordData[],
): Array<ChordData & { warnings: ChordWarning[] | null }> {
  return chords.map((chord) => {
    const warnings = generateChordWarnings(chord, chords)
    return {
      ...chord,
      warnings: warnings.length > 0 ? warnings : null,
    }
  })
}
