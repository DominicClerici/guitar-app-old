// Standard guitar tuning (low to high): E2, A2, D3, G3, B3, E4
// We represent strings from bottom (high E) to top (low E) for visual display

export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const

export type NoteName = (typeof NOTES)[number]

// Standard tuning - index 0 is the thickest string (low E), index 5 is thinnest (high E)
export const STANDARD_TUNING: NoteName[] = ["E", "A", "D", "G", "B", "E"]

// Open string octaves for standard tuning (E2, A2, D3, G3, B3, E4)
export const STANDARD_TUNING_OCTAVES: number[] = [2, 2, 3, 3, 3, 4]

// Number of frets to display (0 = open string, then frets 1-12)
export const FRET_COUNT = 12

// Frets that have single dot markers
export const SINGLE_DOT_FRETS = [3, 5, 7, 9]

// Frets that have double dot markers (12th fret = octave)
export const DOUBLE_DOT_FRETS = [12]

/**
 * Get the note at a specific string and fret position
 * @param stringIndex - 0 = low E (6th string), 5 = high E (1st string)
 * @param fret - 0 = open, 1-12 = fret number
 */
export function getNoteAtPosition(
  stringIndex: number,
  fret: number,
  tuning: NoteName[] = STANDARD_TUNING,
): NoteName {
  const openNote = tuning[stringIndex]
  const openNoteIndex = NOTES.indexOf(openNote)
  const noteIndex = (openNoteIndex + fret) % 12
  return NOTES[noteIndex]
}

/**
 * Get all positions on the fretboard that match a specific note
 */
export function getPositionsForNote(
  note: NoteName,
  tuning: NoteName[] = STANDARD_TUNING,
  maxFret: number = FRET_COUNT,
): Array<{ stringIndex: number; fret: number }> {
  const positions: Array<{ stringIndex: number; fret: number }> = []

  for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      if (getNoteAtPosition(stringIndex, fret, tuning) === note) {
        positions.push({ stringIndex, fret })
      }
    }
  }

  return positions
}

export interface FretPosition {
  stringIndex: number
  fret: number
  note: NoteName
}

/**
 * Get the octave for a note at a specific string and fret position
 * @param stringIndex - 0 = low E (6th string), 5 = high E (1st string)
 * @param fret - 0 = open, 1-12 = fret number
 * @param tuning - Array of note names for each string
 * @param tuningOctaves - Array of octave numbers for each open string
 */
export function getOctaveAtPosition(
  stringIndex: number,
  fret: number,
  tuning: NoteName[] = STANDARD_TUNING,
  tuningOctaves: number[] = STANDARD_TUNING_OCTAVES,
): number {
  const openNote = tuning[stringIndex]
  const openNoteIndex = NOTES.indexOf(openNote)
  const openOctave = tuningOctaves[stringIndex]

  // Calculate how many semitones we've moved from the open string
  const totalSemitones = openNoteIndex + fret

  // Each time we pass 12 semitones from C, we increment the octave
  // Since notes wrap at C (index 0), we need to count how many times we've wrapped
  const octaveIncrements = Math.floor(totalSemitones / 12) - Math.floor(openNoteIndex / 12)

  return openOctave + octaveIncrements
}

export interface FretPositionWithOctave extends FretPosition {
  octave: number
}

/**
 * Get all positions on the fretboard that match a specific note and octave
 */
export function getPositionsForNoteWithOctave(
  note: NoteName,
  octave: number,
  tuning: NoteName[] = STANDARD_TUNING,
  tuningOctaves: number[] = STANDARD_TUNING_OCTAVES,
  maxFret: number = FRET_COUNT,
): Array<{ stringIndex: number; fret: number }> {
  const positions: Array<{ stringIndex: number; fret: number }> = []

  for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const posNote = getNoteAtPosition(stringIndex, fret, tuning)
      const posOctave = getOctaveAtPosition(stringIndex, fret, tuning, tuningOctaves)

      if (posNote === note && posOctave === octave) {
        positions.push({ stringIndex, fret })
      }
    }
  }

  return positions
}

// Scale definitions - intervals in semitones from root
const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11], // W W H W W W H
} as const

export type ScaleType = keyof typeof SCALE_INTERVALS

// Arpeggio definitions - intervals in semitones from root (chord tones: 1, 3, 5, 7)
const ARPEGGIO_INTERVALS = {
  major7: [0, 4, 7, 11], // 1, 3, 5, 7 (major 7th)
  dominant7: [0, 4, 7, 10], // 1, 3, 5, b7 (dominant 7th)
  minor7: [0, 3, 7, 10], // 1, b3, 5, b7 (minor 7th)
  minorMajor7: [0, 3, 7, 11], // 1, b3, 5, 7 (minor major 7th)
  diminished7: [0, 3, 6, 9], // 1, b3, b5, bb7 (diminished 7th)
  halfDiminished7: [0, 3, 6, 10], // 1, b3, b5, b7 (half-diminished/m7b5)
  augmented7: [0, 4, 8, 10], // 1, 3, #5, b7 (augmented 7th)
  augmentedMajor7: [0, 4, 8, 11], // 1, 3, #5, 7 (augmented major 7th)
} as const

export type ArpeggioType = keyof typeof ARPEGGIO_INTERVALS

// Human-readable labels for arpeggio types
export const ARPEGGIO_LABELS: Record<ArpeggioType, string> = {
  major7: "Major 7",
  dominant7: "Dominant 7",
  minor7: "Minor 7",
  minorMajor7: "Minor Major 7",
  diminished7: "Diminished 7",
  halfDiminished7: "Half-Dim 7",
  augmented7: "Augmented 7",
  augmentedMajor7: "Aug Major 7",
}

// Short labels for compact display
export const ARPEGGIO_SHORT_LABELS: Record<ArpeggioType, string> = {
  major7: "Δ7",
  dominant7: "7",
  minor7: "m7",
  minorMajor7: "mΔ7",
  diminished7: "°7",
  halfDiminished7: "ø7",
  augmented7: "+7",
  augmentedMajor7: "+Δ7",
}

// All arpeggio types for iteration
export const ARPEGGIO_TYPES: ArpeggioType[] = Object.keys(ARPEGGIO_INTERVALS) as ArpeggioType[]

/**
 * Get all notes in a scale given a root note
 */
export function getScaleNotes(root: NoteName, scaleType: ScaleType = "major"): NoteName[] {
  const rootIndex = NOTES.indexOf(root)
  const intervals = SCALE_INTERVALS[scaleType]

  return intervals.map((interval) => {
    const noteIndex = (rootIndex + interval) % 12
    return NOTES[noteIndex]
  })
}

export interface ScalePosition {
  stringIndex: number
  fret: number
  note: NoteName
  degree: number // 1-7
  isRoot: boolean
}

/**
 * Get all positions on the fretboard for a scale
 */
export function getScalePositions(
  root: NoteName,
  scaleType: ScaleType = "major",
  tuning: NoteName[] = STANDARD_TUNING,
  maxFret: number = FRET_COUNT,
): ScalePosition[] {
  const positions: ScalePosition[] = []
  const scaleNotes = getScaleNotes(root, scaleType)

  for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const note = getNoteAtPosition(stringIndex, fret, tuning)
      const degreeIndex = scaleNotes.indexOf(note)

      if (degreeIndex !== -1) {
        const degree = degreeIndex + 1 // 1-indexed
        positions.push({
          stringIndex,
          fret,
          note,
          degree,
          isRoot: degree === 1,
        })
      }
    }
  }

  return positions
}

export interface ScaleBoxPosition {
  startFret: number
  endFret: number // May exceed FRET_COUNT if wrapping is needed
  rootFret: number // The fret where a root note is located (on bass strings)
  rootStringIndex: number // Which string has the primary root (0 = low E, 1 = A)
  label: string // e.g., "Position 1", "Position 2"
  wraps: boolean // True if this box wraps around from high frets to low frets
}

/**
 * Find all scale box positions for a given root note.
 * Each position is a 4-5 fret span where you can play the scale across all strings.
 * Positions are determined by root note locations on the 6th and 5th strings.
 * Boxes that extend past fret 12 will wrap around to the beginning (fret 1).
 */
export function getScaleBoxPositions(
  root: NoteName,
  tuning: NoteName[] = STANDARD_TUNING,
  maxFret: number = FRET_COUNT,
): ScaleBoxPosition[] {
  const positions: ScaleBoxPosition[] = []

  // Find root notes on the 6th string (low E) and 5th string (A)
  // These are the anchor points for scale positions
  const rootPositionsString6: number[] = []
  const rootPositionsString5: number[] = []

  for (let fret = 0; fret <= maxFret; fret++) {
    if (getNoteAtPosition(0, fret, tuning) === root) {
      rootPositionsString6.push(fret)
    }
    if (getNoteAtPosition(1, fret, tuning) === root) {
      rootPositionsString5.push(fret)
    }
  }

  // Combine and sort all root positions with their string info
  const allRoots: Array<{ fret: number; stringIndex: number }> = [
    ...rootPositionsString6.map((fret) => ({ fret, stringIndex: 0 })),
    ...rootPositionsString5.map((fret) => ({ fret, stringIndex: 1 })),
  ].sort((a, b) => a.fret - b.fret)

  // Create box positions - each box spans 4 frets (root fret to root fret + 3)
  // This covers all scale notes within that position
  const seenStartFrets = new Set<number>()
  let positionNumber = 1

  for (const rootPos of allRoots) {
    // Skip open position (fret 0) as a starting position - it's awkward to play
    // But we can reference it for the box calculation
    let startFret: number
    let endFret: number

    if (rootPos.stringIndex === 0) {
      // Root on 6th string: box starts 1 fret before root (for the 7th degree)
      startFret = Math.max(1, rootPos.fret)
      endFret = startFret + 3
    } else {
      // Root on 5th string: box starts 2 frets before root
      startFret = Math.max(1, rootPos.fret - 2)
      endFret = startFret + 3
    }

    // Skip if we've already created a position at this start fret
    if (seenStartFrets.has(startFret)) continue

    seenStartFrets.add(startFret)

    // Check if this box wraps around past fret 12
    const wraps = endFret > maxFret

    positions.push({
      startFret,
      endFret,
      rootFret: rootPos.fret,
      rootStringIndex: rootPos.stringIndex,
      label: `Position ${positionNumber}`,
      wraps,
    })

    positionNumber++
  }

  return positions
}

/**
 * Get scale positions for a box that may wrap around the fretboard.
 * If endFret > maxFret, notes beyond maxFret wrap to frets 1, 2, etc.
 * This allows showing complete scale shapes even when starting near the end of the fretboard.
 *
 * IMPORTANT: This function builds a proper scale box where each scale degree (1-7)
 * appears exactly once per octave, creating an ascending path from low to high strings.
 * It picks positions within comfortable finger reach of the box center.
 */
export function getScalePositionsWithWrap(
  root: NoteName,
  scaleType: ScaleType = "major",
  startFret: number,
  endFret: number,
  tuning: NoteName[] = STANDARD_TUNING,
  maxFret: number = FRET_COUNT,
): ScalePosition[] {
  const scaleNotes = getScaleNotes(root, scaleType)
  const boxCenter = (startFret + endFret) / 2

  // Maximum reach from the box center
  const maxReach = 4

  // Collect all candidate positions across all strings
  type Candidate = {
    stringIndex: number
    fret: number
    displayFret: number
    degree: number
    note: NoteName
    distance: number
    octave: number
  }

  const allCandidates: Candidate[] = []

  for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
    for (let fret = 0; fret <= maxFret + maxReach; fret++) {
      const note = getNoteAtPosition(stringIndex, fret, tuning)
      const degreeIndex = scaleNotes.indexOf(note)

      if (degreeIndex !== -1) {
        let displayFret: number
        let distance: number

        if (fret > maxFret) {
          displayFret = fret - maxFret
          distance = Math.min(
            Math.abs(fret - boxCenter),
            Math.abs(displayFret - boxCenter)
          )
        } else {
          displayFret = fret
          distance = Math.abs(fret - boxCenter)
        }

        if (distance <= maxReach) {
          const octave = getOctaveAtPosition(stringIndex, fret, tuning)
          allCandidates.push({
            stringIndex,
            fret,
            displayFret,
            degree: degreeIndex + 1,
            note,
            distance,
            octave,
          })
        }
      }
    }
  }

  // Group candidates by (degree, octave) - each combination should appear once
  const degreeOctaveKey = (degree: number, octave: number) => `${degree}-${octave}`
  const selectedPositions = new Map<string, Candidate>()

  // Sort candidates by distance from center (prefer closer positions)
  // Tiebreaker: prefer higher fret numbers when distances are equal
  allCandidates.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance
    }
    // Equal distance: prefer higher fret number
    return b.displayFret - a.displayFret
  })

  // For each candidate, only keep it if we haven't already selected this degree+octave
  for (const candidate of allCandidates) {
    const key = degreeOctaveKey(candidate.degree, candidate.octave)
    if (!selectedPositions.has(key)) {
      selectedPositions.set(key, candidate)
    }
  }

  // Convert to ScalePosition array
  const positions: ScalePosition[] = []
  for (const pos of selectedPositions.values()) {
    positions.push({
      stringIndex: pos.stringIndex,
      fret: pos.displayFret,
      note: pos.note,
      degree: pos.degree,
      isRoot: pos.degree === 1,
    })
  }

  return positions
}

/**
 * Find or create a valid scale box that contains the given fret.
 * This ensures we can always show a position view for any tapped fret.
 *
 * Strategy:
 * 1. First, try to find an existing box from getScaleBoxPositions that contains the fret
 * 2. If no existing box contains it, create a new box centered around the fret
 *    that aligns with scale fingering patterns
 *
 * @returns An object with the box and its index (index is -1 if it's a newly created box)
 */
export function findOrCreateBoxForFret(
  fret: number,
  root: NoteName,
  tuning: NoteName[] = STANDARD_TUNING,
  maxFret: number = FRET_COUNT,
): { box: ScaleBoxPosition; existingIndex: number } {
  const existingBoxes = getScaleBoxPositions(root, tuning, maxFret)

  // Check if any existing box contains this fret
  const existingIndex = existingBoxes.findIndex((box) =>
    (fret >= box.startFret && fret <= Math.min(box.endFret, maxFret)) ||
    (box.wraps && fret >= 1 && fret <= box.endFret - maxFret)
  )
  if (existingIndex !== -1) {
    return { box: existingBoxes[existingIndex], existingIndex }
  }

  // No existing box contains this fret - create a new one
  // Find the nearest root note positions to anchor the box properly
  const rootPositions: Array<{ fret: number; stringIndex: number }> = []

  // Check all strings for root positions
  for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
    for (let f = 1; f <= maxFret; f++) {
      if (getNoteAtPosition(stringIndex, f, tuning) === root) {
        rootPositions.push({ fret: f, stringIndex })
      }
    }
  }

  // Find the best root position to anchor the box
  // Prefer roots on bass strings (0, 1) as they define standard CAGED positions
  // The box should contain the tapped fret

  let bestBox: ScaleBoxPosition | null = null
  let bestDistance = Infinity

  for (const rootPos of rootPositions) {
    // Calculate potential box boundaries based on root string
    let startFret: number
    let endFret: number

    if (rootPos.stringIndex === 0) {
      // Root on 6th string: box typically starts at or just before the root
      startFret = Math.max(1, rootPos.fret)
      endFret = startFret + 3
    } else if (rootPos.stringIndex === 1) {
      // Root on 5th string: box starts 2 frets before root
      startFret = Math.max(1, rootPos.fret - 2)
      endFret = startFret + 3
    } else {
      // For other strings, create a box that spans 4 frets including the root
      startFret = Math.max(1, rootPos.fret - 1)
      endFret = startFret + 3
    }

    // Check if this box would contain the tapped fret
    const wraps = endFret > maxFret
    const containsFret =
      (fret >= startFret && fret <= Math.min(endFret, maxFret)) ||
      (wraps && fret >= 1 && fret <= endFret - maxFret)

    if (containsFret) {
      // Calculate how "central" the tapped fret is to this box (prefer centered positions)
      const boxCenter = startFret + 1.5
      const distance = Math.abs(fret - boxCenter)

      if (distance < bestDistance) {
        bestDistance = distance
        bestBox = {
          startFret,
          endFret,
          rootFret: rootPos.fret,
          rootStringIndex: rootPos.stringIndex,
          label: `Position`,
          wraps,
        }
      }
    }
  }

  // If we found a valid box anchored to a root, use it
  if (bestBox) {
    return { box: bestBox, existingIndex: -1 }
  }

  // Fallback: create a box centered on the tapped fret
  // This handles edge cases where no root-anchored box works
  const startFret = Math.max(1, fret - 1)
  const endFret = startFret + 3
  const wraps = endFret > maxFret

  return {
    box: {
      startFret,
      endFret,
      rootFret: fret,
      rootStringIndex: 0,
      label: `Position`,
      wraps,
    },
    existingIndex: -1,
  }
}

// ============================================================================
// ARPEGGIO FUNCTIONS
// ============================================================================

/**
 * Get all notes in an arpeggio given a root note
 */
export function getArpeggioNotes(root: NoteName, arpeggioType: ArpeggioType = "major7"): NoteName[] {
  const rootIndex = NOTES.indexOf(root)
  const intervals = ARPEGGIO_INTERVALS[arpeggioType]

  return intervals.map((interval) => {
    const noteIndex = (rootIndex + interval) % 12
    return NOTES[noteIndex]
  })
}

export interface ArpeggioPosition {
  stringIndex: number
  fret: number
  note: NoteName
  degree: number // 1, 3, 5, or 7
  isRoot: boolean
}

/**
 * Get all positions on the fretboard for an arpeggio
 */
export function getArpeggioPositions(
  root: NoteName,
  arpeggioType: ArpeggioType = "major7",
  tuning: NoteName[] = STANDARD_TUNING,
  maxFret: number = FRET_COUNT,
): ArpeggioPosition[] {
  const positions: ArpeggioPosition[] = []
  const arpeggioNotes = getArpeggioNotes(root, arpeggioType)

  // Map index to scale degree (1, 3, 5, 7)
  const degreeMap = [1, 3, 5, 7]

  for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const note = getNoteAtPosition(stringIndex, fret, tuning)
      const noteIndex = arpeggioNotes.indexOf(note)

      if (noteIndex !== -1) {
        const degree = degreeMap[noteIndex]
        positions.push({
          stringIndex,
          fret,
          note,
          degree,
          isRoot: degree === 1,
        })
      }
    }
  }

  return positions
}

export interface ArpeggioBoxPosition {
  startFret: number
  endFret: number
  rootFret: number
  rootStringIndex: number
  label: string
  wraps: boolean
}

/**
 * Find all arpeggio box positions for a given root note.
 * Each position is a 4-5 fret span where you can play the arpeggio across all strings.
 * Positions are determined by root note locations on the 6th and 5th strings.
 */
export function getArpeggioBoxPositions(
  root: NoteName,
  tuning: NoteName[] = STANDARD_TUNING,
  maxFret: number = FRET_COUNT,
): ArpeggioBoxPosition[] {
  const positions: ArpeggioBoxPosition[] = []

  // Find root notes on the 6th string (low E) and 5th string (A)
  const rootPositionsString6: number[] = []
  const rootPositionsString5: number[] = []

  for (let fret = 0; fret <= maxFret; fret++) {
    if (getNoteAtPosition(0, fret, tuning) === root) {
      rootPositionsString6.push(fret)
    }
    if (getNoteAtPosition(1, fret, tuning) === root) {
      rootPositionsString5.push(fret)
    }
  }

  // Combine and sort all root positions with their string info
  const allRoots: Array<{ fret: number; stringIndex: number }> = [
    ...rootPositionsString6.map((fret) => ({ fret, stringIndex: 0 })),
    ...rootPositionsString5.map((fret) => ({ fret, stringIndex: 1 })),
  ].sort((a, b) => a.fret - b.fret)

  // Create box positions
  const seenStartFrets = new Set<number>()
  let positionNumber = 1

  for (const rootPos of allRoots) {
    let startFret: number
    let endFret: number

    if (rootPos.stringIndex === 0) {
      startFret = Math.max(1, rootPos.fret)
      endFret = startFret + 3
    } else {
      startFret = Math.max(1, rootPos.fret - 2)
      endFret = startFret + 3
    }

    if (seenStartFrets.has(startFret)) continue

    seenStartFrets.add(startFret)

    const wraps = endFret > maxFret

    positions.push({
      startFret,
      endFret,
      rootFret: rootPos.fret,
      rootStringIndex: rootPos.stringIndex,
      label: `Position ${positionNumber}`,
      wraps,
    })

    positionNumber++
  }

  return positions
}

/**
 * Get arpeggio positions for a box that may wrap around the fretboard.
 * Similar to getScalePositionsWithWrap but for arpeggios.
 *
 * When rootFret and rootStringIndex are provided, positions are selected
 * based on proximity to the root note, creating more playable fingerings.
 */
export function getArpeggioPositionsWithWrap(
  root: NoteName,
  arpeggioType: ArpeggioType = "major7",
  startFret: number,
  endFret: number,
  tuning: NoteName[] = STANDARD_TUNING,
  maxFret: number = FRET_COUNT,
  rootFret?: number,
  rootStringIndex?: number,
): ArpeggioPosition[] {
  const arpeggioNotes = getArpeggioNotes(root, arpeggioType)
  // Use root position if provided, otherwise fall back to box center
  const anchorFret = rootFret ?? (startFret + endFret) / 2
  const maxReach = 4

  // Map index to scale degree (1, 3, 5, 7)
  const degreeMap = [1, 3, 5, 7]

  type Candidate = {
    stringIndex: number
    fret: number
    displayFret: number
    degree: number
    note: NoteName
    distance: number
    octave: number
  }

  const allCandidates: Candidate[] = []

  for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
    for (let fret = 0; fret <= maxFret + maxReach; fret++) {
      const note = getNoteAtPosition(stringIndex, fret, tuning)
      const noteIndex = arpeggioNotes.indexOf(note)

      if (noteIndex !== -1) {
        let displayFret: number
        let distance: number

        if (fret > maxFret) {
          displayFret = fret - maxFret
          distance = Math.min(
            Math.abs(fret - anchorFret),
            Math.abs(displayFret - anchorFret)
          )
        } else {
          displayFret = fret
          distance = Math.abs(fret - anchorFret)
        }

        if (distance <= maxReach) {
          const octave = getOctaveAtPosition(stringIndex, fret, tuning)
          allCandidates.push({
            stringIndex,
            fret,
            displayFret,
            degree: degreeMap[noteIndex],
            note,
            distance,
            octave,
          })
        }
      }
    }
  }

  // Group candidates by (degree, octave)
  const degreeOctaveKey = (degree: number, octave: number) => `${degree}-${octave}`
  const selectedPositions = new Map<string, Candidate>()

  // Sort by distance, prefer higher frets when equal
  allCandidates.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance
    }
    return b.displayFret - a.displayFret
  })

  for (const candidate of allCandidates) {
    const key = degreeOctaveKey(candidate.degree, candidate.octave)
    if (!selectedPositions.has(key)) {
      selectedPositions.set(key, candidate)
    }
  }

  const positions: ArpeggioPosition[] = []
  for (const pos of selectedPositions.values()) {
    positions.push({
      stringIndex: pos.stringIndex,
      fret: pos.displayFret,
      note: pos.note,
      degree: pos.degree,
      isRoot: pos.degree === 1,
    })
  }

  return positions
}

/**
 * Find or create a valid arpeggio box that contains the given fret.
 */
export function findOrCreateArpeggioBoxForFret(
  fret: number,
  root: NoteName,
  tuning: NoteName[] = STANDARD_TUNING,
  maxFret: number = FRET_COUNT,
): { box: ArpeggioBoxPosition; existingIndex: number } {
  const existingBoxes = getArpeggioBoxPositions(root, tuning, maxFret)

  const existingIndex = existingBoxes.findIndex((box) =>
    (fret >= box.startFret && fret <= Math.min(box.endFret, maxFret)) ||
    (box.wraps && fret >= 1 && fret <= box.endFret - maxFret)
  )
  if (existingIndex !== -1) {
    return { box: existingBoxes[existingIndex], existingIndex }
  }

  // Create a new box
  const rootPositions: Array<{ fret: number; stringIndex: number }> = []

  for (let stringIndex = 0; stringIndex < tuning.length; stringIndex++) {
    for (let f = 1; f <= maxFret; f++) {
      if (getNoteAtPosition(stringIndex, f, tuning) === root) {
        rootPositions.push({ fret: f, stringIndex })
      }
    }
  }

  let bestBox: ArpeggioBoxPosition | null = null
  let bestDistance = Infinity

  for (const rootPos of rootPositions) {
    let startFret: number
    let endFret: number

    if (rootPos.stringIndex === 0) {
      startFret = Math.max(1, rootPos.fret)
      endFret = startFret + 3
    } else if (rootPos.stringIndex === 1) {
      startFret = Math.max(1, rootPos.fret - 2)
      endFret = startFret + 3
    } else {
      startFret = Math.max(1, rootPos.fret - 1)
      endFret = startFret + 3
    }

    const wraps = endFret > maxFret
    const containsFret =
      (fret >= startFret && fret <= Math.min(endFret, maxFret)) ||
      (wraps && fret >= 1 && fret <= endFret - maxFret)

    if (containsFret) {
      const boxCenter = startFret + 1.5
      const distance = Math.abs(fret - boxCenter)

      if (distance < bestDistance) {
        bestDistance = distance
        bestBox = {
          startFret,
          endFret,
          rootFret: rootPos.fret,
          rootStringIndex: rootPos.stringIndex,
          label: `Position`,
          wraps,
        }
      }
    }
  }

  if (bestBox) {
    return { box: bestBox, existingIndex: -1 }
  }

  // Fallback
  const startFret = Math.max(1, fret - 1)
  const newEndFret = startFret + 3
  const wraps = newEndFret > maxFret

  return {
    box: {
      startFret,
      endFret: newEndFret,
      rootFret: fret,
      rootStringIndex: 0,
      label: `Position`,
      wraps,
    },
    existingIndex: -1,
  }
}
