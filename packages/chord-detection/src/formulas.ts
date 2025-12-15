/**
 * Comprehensive Chord Formulas Database
 *
 * This module contains an exhaustive database of chord formulas,
 * from basic triads to complex jazz voicings and theoretical constructs.
 *
 * Interval notation: semitones from root (0 = root, 4 = major 3rd, etc.)
 */

import { ChordCategory, ChordFormula, ChordQuality } from "./types"

/**
 * Complete chord formula database
 * Organized by category for easier maintenance
 */
export const CHORD_FORMULAS: ChordFormula[] = [
  // ============================================================================
  // TRIADS (Basic three-note chords)
  // ============================================================================

  // Major Triad
  {
    name: "major",
    symbol: "",
    alternateSymbols: ["maj", "M", "Δ"],
    intervals: [0, 4, 7],
    requiredIntervals: [0, 4, 7],
    optionalIntervals: [],
    quality: ChordQuality.Major,
    category: ChordCategory.Triad,
    rarity: 1,
    description: "The most fundamental major chord",
  },

  // Minor Triad
  {
    name: "minor",
    symbol: "m",
    alternateSymbols: ["min", "-", "mi"],
    intervals: [0, 3, 7],
    requiredIntervals: [0, 3, 7],
    optionalIntervals: [],
    quality: ChordQuality.Minor,
    category: ChordCategory.Triad,
    rarity: 1,
    description: "The most fundamental minor chord",
  },

  // Diminished Triad
  {
    name: "diminished",
    symbol: "dim",
    alternateSymbols: ["°", "o", "mb5"],
    intervals: [0, 3, 6],
    requiredIntervals: [0, 3, 6],
    optionalIntervals: [],
    quality: ChordQuality.Diminished,
    category: ChordCategory.Triad,
    rarity: 2,
    description: "Minor third with diminished fifth",
  },

  // Augmented Triad
  {
    name: "augmented",
    symbol: "aug",
    alternateSymbols: ["+", "#5"],
    intervals: [0, 4, 8],
    requiredIntervals: [0, 4, 8],
    optionalIntervals: [],
    quality: ChordQuality.Augmented,
    category: ChordCategory.Triad,
    rarity: 3,
    description: "Major third with augmented fifth",
  },

  // ============================================================================
  // SUSPENDED CHORDS
  // ============================================================================

  // Sus4
  {
    name: "suspended 4th",
    symbol: "sus4",
    alternateSymbols: ["sus"],
    intervals: [0, 5, 7],
    requiredIntervals: [0, 5, 7],
    optionalIntervals: [],
    quality: ChordQuality.Sus4,
    category: ChordCategory.Suspended,
    rarity: 2,
    description: "Fourth replaces the third",
  },

  // Sus2
  {
    name: "suspended 2nd",
    symbol: "sus2",
    alternateSymbols: [],
    intervals: [0, 2, 7],
    requiredIntervals: [0, 2, 7],
    optionalIntervals: [],
    quality: ChordQuality.Sus2,
    category: ChordCategory.Suspended,
    rarity: 2,
    description: "Second replaces the third",
  },

  // Sus4(b5) - Rare but valid
  {
    name: "suspended 4th flat 5",
    symbol: "sus4(b5)",
    alternateSymbols: ["sus(b5)"],
    intervals: [0, 5, 6],
    requiredIntervals: [0, 5, 6],
    optionalIntervals: [],
    quality: ChordQuality.Sus4,
    category: ChordCategory.Suspended,
    rarity: 7,
    description: "Suspended fourth with diminished fifth",
  },

  // ============================================================================
  // POWER CHORDS
  // ============================================================================

  {
    name: "power chord",
    symbol: "5",
    alternateSymbols: ["(no3)", "no3rd"],
    intervals: [0, 7],
    requiredIntervals: [0, 7],
    optionalIntervals: [],
    quality: ChordQuality.Power,
    category: ChordCategory.Power,
    rarity: 1,
    description: "Root and fifth only - ambiguous quality",
  },

  // ============================================================================
  // SEVENTH CHORDS
  // ============================================================================

  // Major 7th
  {
    name: "major 7th",
    symbol: "maj7",
    alternateSymbols: ["Δ7", "M7", "ma7", "j7"],
    intervals: [0, 4, 7, 11],
    requiredIntervals: [0, 4, 11],
    optionalIntervals: [7],
    quality: ChordQuality.Major,
    category: ChordCategory.Seventh,
    rarity: 1,
    description: "Major triad with major 7th",
  },

  // Dominant 7th
  {
    name: "dominant 7th",
    symbol: "7",
    alternateSymbols: ["dom7"],
    intervals: [0, 4, 7, 10],
    requiredIntervals: [0, 4, 10],
    optionalIntervals: [7],
    quality: ChordQuality.Dominant,
    category: ChordCategory.Seventh,
    rarity: 1,
    description: "Major triad with minor 7th - creates tension",
  },

  // Minor 7th
  {
    name: "minor 7th",
    symbol: "m7",
    alternateSymbols: ["min7", "-7", "mi7"],
    intervals: [0, 3, 7, 10],
    requiredIntervals: [0, 3, 10],
    optionalIntervals: [7],
    quality: ChordQuality.Minor,
    category: ChordCategory.Seventh,
    rarity: 1,
    description: "Minor triad with minor 7th",
  },

  // Minor Major 7th
  {
    name: "minor major 7th",
    symbol: "m(maj7)",
    alternateSymbols: ["mM7", "minmaj7", "-Δ7", "m/M7", "mΔ7"],
    intervals: [0, 3, 7, 11],
    requiredIntervals: [0, 3, 11],
    optionalIntervals: [7],
    quality: ChordQuality.Minor,
    category: ChordCategory.Seventh,
    rarity: 4,
    description: "Minor triad with major 7th - dark and tense",
  },

  // Half-Diminished 7th (Minor 7 flat 5)
  {
    name: "half-diminished 7th",
    symbol: "m7b5",
    alternateSymbols: ["ø", "ø7", "m7(b5)", "-7b5"],
    intervals: [0, 3, 6, 10],
    requiredIntervals: [0, 3, 6, 10],
    optionalIntervals: [],
    quality: ChordQuality.HalfDiminished,
    category: ChordCategory.Seventh,
    rarity: 2,
    description: "Diminished triad with minor 7th",
  },

  // Diminished 7th (Fully Diminished)
  {
    name: "diminished 7th",
    symbol: "dim7",
    alternateSymbols: ["°7", "o7"],
    intervals: [0, 3, 6, 9],
    requiredIntervals: [0, 3, 6, 9],
    optionalIntervals: [],
    quality: ChordQuality.Diminished,
    category: ChordCategory.Seventh,
    rarity: 2,
    description: "Symmetrical chord - diminished triad with diminished 7th",
  },

  // Augmented Major 7th
  {
    name: "augmented major 7th",
    symbol: "maj7#5",
    alternateSymbols: ["Δ7#5", "+M7", "augM7", "M7#5"],
    intervals: [0, 4, 8, 11],
    requiredIntervals: [0, 4, 8, 11],
    optionalIntervals: [],
    quality: ChordQuality.Augmented,
    category: ChordCategory.Seventh,
    rarity: 4,
    description: "Augmented triad with major 7th",
  },

  // Augmented 7th (Dominant)
  {
    name: "augmented 7th",
    symbol: "7#5",
    alternateSymbols: ["aug7", "+7", "7+"],
    intervals: [0, 4, 8, 10],
    requiredIntervals: [0, 4, 8, 10],
    optionalIntervals: [],
    quality: ChordQuality.Augmented,
    category: ChordCategory.Seventh,
    rarity: 3,
    description: "Augmented triad with minor 7th",
  },

  // Dominant 7th flat 5
  {
    name: "dominant 7th flat 5",
    symbol: "7b5",
    alternateSymbols: ["7(b5)", "dom7b5"],
    intervals: [0, 4, 6, 10],
    requiredIntervals: [0, 4, 6, 10],
    optionalIntervals: [],
    quality: ChordQuality.Dominant,
    category: ChordCategory.Seventh,
    rarity: 4,
    description: "Dominant 7th with diminished 5th",
  },

  // Diminished Major 7th (rare)
  {
    name: "diminished major 7th",
    symbol: "dim(maj7)",
    alternateSymbols: ["°M7", "dimM7"],
    intervals: [0, 3, 6, 11],
    requiredIntervals: [0, 3, 6, 11],
    optionalIntervals: [],
    quality: ChordQuality.Diminished,
    category: ChordCategory.Seventh,
    rarity: 8,
    description: "Rare - diminished triad with major 7th",
  },

  // ============================================================================
  // SIXTH CHORDS
  // ============================================================================

  // Major 6th
  {
    name: "major 6th",
    symbol: "6",
    alternateSymbols: ["maj6", "add6", "M6"],
    intervals: [0, 4, 7, 9],
    requiredIntervals: [0, 4, 9],
    optionalIntervals: [7],
    quality: ChordQuality.Major,
    category: ChordCategory.Added,
    rarity: 2,
    description: "Major triad with added major 6th",
  },

  // Minor 6th
  {
    name: "minor 6th",
    symbol: "m6",
    alternateSymbols: ["min6", "-6"],
    intervals: [0, 3, 7, 9],
    requiredIntervals: [0, 3, 9],
    optionalIntervals: [7],
    quality: ChordQuality.Minor,
    category: ChordCategory.Added,
    rarity: 2,
    description: "Minor triad with added major 6th",
  },

  // ============================================================================
  // SUSPENDED SEVENTH CHORDS
  // ============================================================================

  // 7sus4
  {
    name: "dominant 7th sus4",
    symbol: "7sus4",
    alternateSymbols: ["7sus"],
    intervals: [0, 5, 7, 10],
    requiredIntervals: [0, 5, 10],
    optionalIntervals: [7],
    quality: ChordQuality.Sus4,
    category: ChordCategory.Suspended,
    rarity: 2,
    description: "Dominant 7th with 4th instead of 3rd",
  },

  // 7sus2
  {
    name: "dominant 7th sus2",
    symbol: "7sus2",
    alternateSymbols: [],
    intervals: [0, 2, 7, 10],
    requiredIntervals: [0, 2, 10],
    optionalIntervals: [7],
    quality: ChordQuality.Sus2,
    category: ChordCategory.Suspended,
    rarity: 4,
    description: "Dominant 7th with 2nd instead of 3rd",
  },

  // maj7sus4
  {
    name: "major 7th sus4",
    symbol: "maj7sus4",
    alternateSymbols: ["Δ7sus4", "M7sus4"],
    intervals: [0, 5, 7, 11],
    requiredIntervals: [0, 5, 11],
    optionalIntervals: [7],
    quality: ChordQuality.Sus4,
    category: ChordCategory.Suspended,
    rarity: 4,
    description: "Major 7th with 4th instead of 3rd",
  },

  // maj7sus2
  {
    name: "major 7th sus2",
    symbol: "maj7sus2",
    alternateSymbols: ["Δ7sus2", "M7sus2"],
    intervals: [0, 2, 7, 11],
    requiredIntervals: [0, 2, 11],
    optionalIntervals: [7],
    quality: ChordQuality.Sus2,
    category: ChordCategory.Suspended,
    rarity: 5,
    description: "Major 7th with 2nd instead of 3rd",
  },

  // ============================================================================
  // ADD CHORDS
  // ============================================================================

  // Add9
  {
    name: "add 9",
    symbol: "add9",
    alternateSymbols: ["add2", "(add9)"],
    intervals: [0, 4, 7, 14],
    requiredIntervals: [0, 4, 14],
    optionalIntervals: [7],
    quality: ChordQuality.Major,
    category: ChordCategory.Added,
    rarity: 2,
    description: "Major triad with added 9th (no 7th)",
  },

  // Minor add9
  {
    name: "minor add 9",
    symbol: "m(add9)",
    alternateSymbols: ["madd9", "m(add2)", "-add9"],
    intervals: [0, 3, 7, 14],
    requiredIntervals: [0, 3, 14],
    optionalIntervals: [7],
    quality: ChordQuality.Minor,
    category: ChordCategory.Added,
    rarity: 3,
    description: "Minor triad with added 9th (no 7th)",
  },

  // Add4 (add11)
  {
    name: "add 4",
    symbol: "add4",
    alternateSymbols: ["add11", "(add4)"],
    intervals: [0, 4, 5, 7],
    requiredIntervals: [0, 4, 5],
    optionalIntervals: [7],
    quality: ChordQuality.Major,
    category: ChordCategory.Added,
    rarity: 4,
    description: "Major triad with added 4th",
  },

  // Minor add4
  {
    name: "minor add 4",
    symbol: "m(add4)",
    alternateSymbols: ["madd4", "madd11"],
    intervals: [0, 3, 5, 7],
    requiredIntervals: [0, 3, 5],
    optionalIntervals: [7],
    quality: ChordQuality.Minor,
    category: ChordCategory.Added,
    rarity: 5,
    description: "Minor triad with added 4th",
  },

  // 6/9 chord
  {
    name: "6/9",
    symbol: "6/9",
    alternateSymbols: ["69", "6add9"],
    intervals: [0, 4, 7, 9, 14],
    requiredIntervals: [0, 4, 9, 14],
    optionalIntervals: [7],
    quality: ChordQuality.Major,
    category: ChordCategory.Added,
    rarity: 3,
    description: "Major triad with 6th and 9th - bright jazz voicing",
  },

  // Minor 6/9
  {
    name: "minor 6/9",
    symbol: "m6/9",
    alternateSymbols: ["m69", "min6/9"],
    intervals: [0, 3, 7, 9, 14],
    requiredIntervals: [0, 3, 9, 14],
    optionalIntervals: [7],
    quality: ChordQuality.Minor,
    category: ChordCategory.Added,
    rarity: 4,
    description: "Minor triad with 6th and 9th",
  },

  // ============================================================================
  // EXTENDED CHORDS (9th, 11th, 13th)
  // ============================================================================

  // Major 9th
  {
    name: "major 9th",
    symbol: "maj9",
    alternateSymbols: ["Δ9", "M9"],
    intervals: [0, 4, 7, 11, 14],
    requiredIntervals: [0, 4, 11, 14],
    optionalIntervals: [7],
    quality: ChordQuality.Major,
    category: ChordCategory.Extended,
    rarity: 2,
    description: "Major 7th with added 9th",
  },

  // Dominant 9th
  {
    name: "dominant 9th",
    symbol: "9",
    alternateSymbols: ["dom9"],
    intervals: [0, 4, 7, 10, 14],
    requiredIntervals: [0, 4, 10, 14],
    optionalIntervals: [7],
    quality: ChordQuality.Dominant,
    category: ChordCategory.Extended,
    rarity: 1,
    description: "Dominant 7th with added 9th",
  },

  // Minor 9th
  {
    name: "minor 9th",
    symbol: "m9",
    alternateSymbols: ["min9", "-9"],
    intervals: [0, 3, 7, 10, 14],
    requiredIntervals: [0, 3, 10, 14],
    optionalIntervals: [7],
    quality: ChordQuality.Minor,
    category: ChordCategory.Extended,
    rarity: 2,
    description: "Minor 7th with added 9th",
  },

  // Minor Major 9th
  {
    name: "minor major 9th",
    symbol: "m(maj9)",
    alternateSymbols: ["mM9", "minmaj9"],
    intervals: [0, 3, 7, 11, 14],
    requiredIntervals: [0, 3, 11, 14],
    optionalIntervals: [7],
    quality: ChordQuality.Minor,
    category: ChordCategory.Extended,
    rarity: 5,
    description: "Minor major 7th with added 9th",
  },

  // Half-diminished 9th (m9b5)
  {
    name: "half-diminished 9th",
    symbol: "m9b5",
    alternateSymbols: ["ø9", "m9(b5)"],
    intervals: [0, 3, 6, 10, 14],
    requiredIntervals: [0, 3, 6, 10, 14],
    optionalIntervals: [],
    quality: ChordQuality.HalfDiminished,
    category: ChordCategory.Extended,
    rarity: 5,
    description: "Half-diminished with 9th",
  },

  // Major 11th
  {
    name: "major 11th",
    symbol: "maj11",
    alternateSymbols: ["Δ11", "M11"],
    intervals: [0, 4, 7, 11, 14, 17],
    requiredIntervals: [0, 11, 17],
    optionalIntervals: [4, 7, 14],
    quality: ChordQuality.Major,
    category: ChordCategory.Extended,
    rarity: 4,
    description: "Major 9th with added 11th - often voiced without 3rd",
  },

  // Dominant 11th
  {
    name: "dominant 11th",
    symbol: "11",
    alternateSymbols: ["dom11"],
    intervals: [0, 4, 7, 10, 14, 17],
    requiredIntervals: [0, 10, 17],
    optionalIntervals: [4, 7, 14],
    quality: ChordQuality.Dominant,
    category: ChordCategory.Extended,
    rarity: 3,
    description: "Dominant 9th with added 11th",
  },

  // Minor 11th
  {
    name: "minor 11th",
    symbol: "m11",
    alternateSymbols: ["min11", "-11"],
    intervals: [0, 3, 7, 10, 14, 17],
    requiredIntervals: [0, 3, 10, 17],
    optionalIntervals: [7, 14],
    quality: ChordQuality.Minor,
    category: ChordCategory.Extended,
    rarity: 2,
    description: "Minor 9th with added 11th",
  },

  // Major 13th
  {
    name: "major 13th",
    symbol: "maj13",
    alternateSymbols: ["Δ13", "M13"],
    intervals: [0, 4, 7, 11, 14, 17, 21],
    requiredIntervals: [0, 4, 11, 21],
    optionalIntervals: [7, 14, 17],
    quality: ChordQuality.Major,
    category: ChordCategory.Extended,
    rarity: 4,
    description: "Major 11th with added 13th",
  },

  // Dominant 13th
  {
    name: "dominant 13th",
    symbol: "13",
    alternateSymbols: ["dom13"],
    intervals: [0, 4, 7, 10, 14, 17, 21],
    requiredIntervals: [0, 4, 10, 21],
    optionalIntervals: [7, 14, 17],
    quality: ChordQuality.Dominant,
    category: ChordCategory.Extended,
    rarity: 3,
    description: "Dominant 11th with added 13th",
  },

  // Minor 13th
  {
    name: "minor 13th",
    symbol: "m13",
    alternateSymbols: ["min13", "-13"],
    intervals: [0, 3, 7, 10, 14, 17, 21],
    requiredIntervals: [0, 3, 10, 21],
    optionalIntervals: [7, 14, 17],
    quality: ChordQuality.Minor,
    category: ChordCategory.Extended,
    rarity: 3,
    description: "Minor 11th with added 13th",
  },

  // ============================================================================
  // ALTERED DOMINANT CHORDS
  // ============================================================================

  // 7b9
  {
    name: "dominant 7th flat 9",
    symbol: "7b9",
    alternateSymbols: ["7(b9)"],
    intervals: [0, 4, 7, 10, 13],
    requiredIntervals: [0, 4, 10, 13],
    optionalIntervals: [7],
    quality: ChordQuality.Altered,
    category: ChordCategory.Altered,
    rarity: 3,
    description: "Dominant 7th with minor 9th - strong tension",
  },

  // 7#9 (Hendrix chord)
  {
    name: "dominant 7th sharp 9",
    symbol: "7#9",
    alternateSymbols: ["7(#9)"],
    intervals: [0, 4, 7, 10, 15],
    requiredIntervals: [0, 4, 10, 15],
    optionalIntervals: [7],
    quality: ChordQuality.Altered,
    category: ChordCategory.Altered,
    rarity: 3,
    description: 'The "Hendrix chord" - major 3rd with augmented 9th',
  },

  // 7#11
  {
    name: "dominant 7th sharp 11",
    symbol: "7#11",
    alternateSymbols: ["7(#11)", "lyd7"],
    intervals: [0, 4, 7, 10, 18],
    requiredIntervals: [0, 4, 10, 18],
    optionalIntervals: [7],
    quality: ChordQuality.Altered,
    category: ChordCategory.Altered,
    rarity: 4,
    description: "Lydian dominant - tritone substitution sound",
  },

  // 7b13
  {
    name: "dominant 7th flat 13",
    symbol: "7b13",
    alternateSymbols: ["7(b13)"],
    intervals: [0, 4, 7, 10, 20],
    requiredIntervals: [0, 4, 10, 20],
    optionalIntervals: [7],
    quality: ChordQuality.Altered,
    category: ChordCategory.Altered,
    rarity: 5,
    description: "Dominant with minor 13th",
  },

  // 7b9b13
  {
    name: "dominant 7th flat 9 flat 13",
    symbol: "7b9b13",
    alternateSymbols: ["7(b9,b13)"],
    intervals: [0, 4, 7, 10, 13, 20],
    requiredIntervals: [0, 4, 10, 13, 20],
    optionalIntervals: [7],
    quality: ChordQuality.Altered,
    category: ChordCategory.Altered,
    rarity: 5,
    description: "Highly altered dominant",
  },

  // 7#9#11
  {
    name: "dominant 7th sharp 9 sharp 11",
    symbol: "7#9#11",
    alternateSymbols: ["7(#9,#11)"],
    intervals: [0, 4, 7, 10, 15, 18],
    requiredIntervals: [0, 4, 10, 15, 18],
    optionalIntervals: [7],
    quality: ChordQuality.Altered,
    category: ChordCategory.Altered,
    rarity: 6,
    description: "Complex altered dominant",
  },

  // 7alt (fully altered)
  {
    name: "altered dominant",
    symbol: "7alt",
    alternateSymbols: ["alt", "7(alt)"],
    intervals: [0, 4, 6, 10, 13, 15, 20],
    requiredIntervals: [0, 4, 10],
    optionalIntervals: [6, 13, 15, 20],
    quality: ChordQuality.Altered,
    category: ChordCategory.Altered,
    rarity: 5,
    description: "Contains b5, #5, b9, #9 - maximum tension",
  },

  // 9#11
  {
    name: "dominant 9th sharp 11",
    symbol: "9#11",
    alternateSymbols: ["9(#11)", "lyd9"],
    intervals: [0, 4, 7, 10, 14, 18],
    requiredIntervals: [0, 4, 10, 14, 18],
    optionalIntervals: [7],
    quality: ChordQuality.Altered,
    category: ChordCategory.Altered,
    rarity: 4,
    description: "Dominant 9th with lydian flavor",
  },

  // 13#11
  {
    name: "dominant 13th sharp 11",
    symbol: "13#11",
    alternateSymbols: ["13(#11)"],
    intervals: [0, 4, 7, 10, 14, 18, 21],
    requiredIntervals: [0, 4, 10, 18, 21],
    optionalIntervals: [7, 14],
    quality: ChordQuality.Altered,
    category: ChordCategory.Altered,
    rarity: 5,
    description: "Rich altered 13th chord",
  },

  // 13b9
  {
    name: "dominant 13th flat 9",
    symbol: "13b9",
    alternateSymbols: ["13(b9)"],
    intervals: [0, 4, 7, 10, 13, 21],
    requiredIntervals: [0, 4, 10, 13, 21],
    optionalIntervals: [7],
    quality: ChordQuality.Altered,
    category: ChordCategory.Altered,
    rarity: 5,
    description: "Dominant 13th with minor 9th",
  },

  // ============================================================================
  // QUARTAL/QUINTAL CHORDS
  // ============================================================================

  {
    name: "quartal triad",
    symbol: "q",
    alternateSymbols: ["4ths"],
    intervals: [0, 5, 10],
    requiredIntervals: [0, 5, 10],
    optionalIntervals: [],
    quality: ChordQuality.Quartal,
    category: ChordCategory.Quartal,
    rarity: 5,
    description: "Built on stacked perfect 4ths",
  },

  {
    name: "quartal tetrad",
    symbol: "q4",
    alternateSymbols: ["4ths4"],
    intervals: [0, 5, 10, 15],
    requiredIntervals: [0, 5, 10, 15],
    optionalIntervals: [],
    quality: ChordQuality.Quartal,
    category: ChordCategory.Quartal,
    rarity: 6,
    description: "Four notes in stacked 4ths",
  },

  // ============================================================================
  // SPECIAL VOICINGS & HYBRID CHORDS
  // ============================================================================

  // Major 7 #11
  {
    name: "major 7th sharp 11",
    symbol: "maj7#11",
    alternateSymbols: ["Δ7#11", "M7#11", "lyd"],
    intervals: [0, 4, 7, 11, 18],
    requiredIntervals: [0, 4, 11, 18],
    optionalIntervals: [7],
    quality: ChordQuality.Major,
    category: ChordCategory.Extended,
    rarity: 4,
    description: "Lydian major 7th chord",
  },

  // Major 9 #11
  {
    name: "major 9th sharp 11",
    symbol: "maj9#11",
    alternateSymbols: ["Δ9#11", "M9#11"],
    intervals: [0, 4, 7, 11, 14, 18],
    requiredIntervals: [0, 4, 11, 14, 18],
    optionalIntervals: [7],
    quality: ChordQuality.Major,
    category: ChordCategory.Extended,
    rarity: 5,
    description: "Lydian major 9th chord",
  },

  // Major 13 #11
  {
    name: "major 13th sharp 11",
    symbol: "maj13#11",
    alternateSymbols: ["Δ13#11", "M13#11"],
    intervals: [0, 4, 7, 11, 14, 18, 21],
    requiredIntervals: [0, 4, 11, 18, 21],
    optionalIntervals: [7, 14],
    quality: ChordQuality.Major,
    category: ChordCategory.Extended,
    rarity: 6,
    description: "Full lydian voicing",
  },

  // Minor 7 b13 (Aeolian)
  {
    name: "minor 7th flat 13",
    symbol: "m7b13",
    alternateSymbols: ["m7(b13)"],
    intervals: [0, 3, 7, 10, 20],
    requiredIntervals: [0, 3, 10, 20],
    optionalIntervals: [7],
    quality: ChordQuality.Minor,
    category: ChordCategory.Extended,
    rarity: 6,
    description: "Minor 7th with minor 13th",
  },

  // Major add#11
  {
    name: "add sharp 11",
    symbol: "add#11",
    alternateSymbols: ["(add#11)"],
    intervals: [0, 4, 7, 18],
    requiredIntervals: [0, 4, 18],
    optionalIntervals: [7],
    quality: ChordQuality.Major,
    category: ChordCategory.Added,
    rarity: 6,
    description: "Major triad with #11 (no 7th)",
  },

  // ============================================================================
  // TWO-NOTE INTERVALS (Dyads)
  // ============================================================================

  {
    name: "minor 2nd interval",
    symbol: "m2",
    alternateSymbols: ["(m2)"],
    intervals: [0, 1],
    requiredIntervals: [0, 1],
    optionalIntervals: [],
    quality: ChordQuality.Ambiguous,
    category: ChordCategory.Other,
    rarity: 7,
    description: "Semitone interval - highly dissonant",
  },

  {
    name: "major 2nd interval",
    symbol: "M2",
    alternateSymbols: ["(M2)"],
    intervals: [0, 2],
    requiredIntervals: [0, 2],
    optionalIntervals: [],
    quality: ChordQuality.Ambiguous,
    category: ChordCategory.Other,
    rarity: 6,
    description: "Whole tone interval",
  },

  {
    name: "minor 3rd interval",
    symbol: "m3",
    alternateSymbols: ["(m3)"],
    intervals: [0, 3],
    requiredIntervals: [0, 3],
    optionalIntervals: [],
    quality: ChordQuality.Minor,
    category: ChordCategory.Other,
    rarity: 5,
    description: "Minor third dyad - could be part of minor triad",
  },

  {
    name: "major 3rd interval",
    symbol: "M3",
    alternateSymbols: ["(M3)"],
    intervals: [0, 4],
    requiredIntervals: [0, 4],
    optionalIntervals: [],
    quality: ChordQuality.Major,
    category: ChordCategory.Other,
    rarity: 5,
    description: "Major third dyad - could be part of major triad",
  },

  {
    name: "perfect 4th interval",
    symbol: "P4",
    alternateSymbols: ["(P4)"],
    intervals: [0, 5],
    requiredIntervals: [0, 5],
    optionalIntervals: [],
    quality: ChordQuality.Sus4,
    category: ChordCategory.Other,
    rarity: 5,
    description: "Perfect fourth dyad",
  },

  {
    name: "tritone interval",
    symbol: "TT",
    alternateSymbols: ["(b5)", "(#4)"],
    intervals: [0, 6],
    requiredIntervals: [0, 6],
    optionalIntervals: [],
    quality: ChordQuality.Diminished,
    category: ChordCategory.Other,
    rarity: 6,
    description: 'Tritone - the "devil\'s interval"',
  },

  {
    name: "minor 6th interval",
    symbol: "m6",
    alternateSymbols: ["(m6)", "(#5)"],
    intervals: [0, 8],
    requiredIntervals: [0, 8],
    optionalIntervals: [],
    quality: ChordQuality.Augmented,
    category: ChordCategory.Other,
    rarity: 6,
    description: "Minor 6th / augmented 5th dyad",
  },

  {
    name: "major 6th interval",
    symbol: "M6",
    alternateSymbols: ["(M6)"],
    intervals: [0, 9],
    requiredIntervals: [0, 9],
    optionalIntervals: [],
    quality: ChordQuality.Major,
    category: ChordCategory.Other,
    rarity: 5,
    description: "Major 6th dyad",
  },

  {
    name: "minor 7th interval",
    symbol: "m7",
    alternateSymbols: ["(m7)"],
    intervals: [0, 10],
    requiredIntervals: [0, 10],
    optionalIntervals: [],
    quality: ChordQuality.Dominant,
    category: ChordCategory.Other,
    rarity: 5,
    description: "Minor 7th dyad",
  },

  {
    name: "major 7th interval",
    symbol: "M7",
    alternateSymbols: ["(M7)"],
    intervals: [0, 11],
    requiredIntervals: [0, 11],
    optionalIntervals: [],
    quality: ChordQuality.Major,
    category: ChordCategory.Other,
    rarity: 5,
    description: "Major 7th dyad - dissonant",
  },

  // ============================================================================
  // FLAT 9 CHORDS (without standard 9)
  // ============================================================================

  // maj7(b9) - rare but exists
  {
    name: "major 7th flat 9",
    symbol: "maj7b9",
    alternateSymbols: ["Δ7b9", "M7b9"],
    intervals: [0, 4, 7, 11, 13],
    requiredIntervals: [0, 4, 11, 13],
    optionalIntervals: [7],
    quality: ChordQuality.Major,
    category: ChordCategory.Altered,
    rarity: 8,
    description: "Rare - major 7th with minor 9th",
  },

  // m7(b9)
  {
    name: "minor 7th flat 9",
    symbol: "m7b9",
    alternateSymbols: ["m7(b9)", "-7b9"],
    intervals: [0, 3, 7, 10, 13],
    requiredIntervals: [0, 3, 10, 13],
    optionalIntervals: [7],
    quality: ChordQuality.Minor,
    category: ChordCategory.Altered,
    rarity: 6,
    description: "Minor 7th with minor 9th - Phrygian sound",
  },

  // ============================================================================
  // SPECIAL/RARE CHORDS
  // ============================================================================

  // Major b6
  {
    name: "major flat 6",
    symbol: "(b6)",
    alternateSymbols: ["majb6", "Mb6"],
    intervals: [0, 4, 7, 8],
    requiredIntervals: [0, 4, 7, 8],
    optionalIntervals: [],
    quality: ChordQuality.Major,
    category: ChordCategory.Added,
    rarity: 7,
    description: "Major triad with minor 6th - unusual",
  },

  // Minor b6
  {
    name: "minor flat 6",
    symbol: "m(b6)",
    alternateSymbols: ["minb6", "mb6"],
    intervals: [0, 3, 7, 8],
    requiredIntervals: [0, 3, 7, 8],
    optionalIntervals: [],
    quality: ChordQuality.Minor,
    category: ChordCategory.Added,
    rarity: 7,
    description: "Minor triad with minor 6th",
  },

  // Major 7 b5
  {
    name: "major 7th flat 5",
    symbol: "maj7b5",
    alternateSymbols: ["Δ7b5", "M7b5"],
    intervals: [0, 4, 6, 11],
    requiredIntervals: [0, 4, 6, 11],
    optionalIntervals: [],
    quality: ChordQuality.Major,
    category: ChordCategory.Altered,
    rarity: 7,
    description: "Major 7th with diminished 5th - rare",
  },

  // Mu major (add2 with maj7)
  {
    name: "mu major",
    symbol: "μ",
    alternateSymbols: ["add2maj7", "Δadd2"],
    intervals: [0, 2, 4, 7, 11],
    requiredIntervals: [0, 2, 4, 11],
    optionalIntervals: [7],
    quality: ChordQuality.Major,
    category: ChordCategory.Added,
    rarity: 7,
    description: "Steely Dan chord - major with 2nd and maj7",
  },

  // Minor 11 no 5
  {
    name: "minor 11th no 5",
    symbol: "m11(no5)",
    alternateSymbols: ["m11omit5"],
    intervals: [0, 3, 10, 14, 17],
    requiredIntervals: [0, 3, 10, 17],
    optionalIntervals: [14],
    quality: ChordQuality.Minor,
    category: ChordCategory.Extended,
    rarity: 5,
    description: "Minor 11 without the 5th",
  },

  // So What chord (quartal voicing from modal jazz)
  {
    name: "So What voicing",
    symbol: "sw",
    alternateSymbols: ["4thsM3"],
    intervals: [0, 5, 10, 15, 19],
    requiredIntervals: [0, 5, 10, 15, 19],
    optionalIntervals: [],
    quality: ChordQuality.Quartal,
    category: ChordCategory.Quartal,
    rarity: 6,
    description: "Three 4ths topped with a major 3rd",
  },

  // ============================================================================
  // INCOMPLETE/SHELL VOICINGS
  // ============================================================================

  // Shell voicing (3-7)
  {
    name: "shell major 7",
    symbol: "shellΔ",
    alternateSymbols: ["37"],
    intervals: [0, 4, 11],
    requiredIntervals: [0, 4, 11],
    optionalIntervals: [],
    quality: ChordQuality.Major,
    category: ChordCategory.Seventh,
    rarity: 4,
    description: "Root, 3rd, 7th only - common jazz voicing",
  },

  {
    name: "shell dominant 7",
    symbol: "shell7",
    alternateSymbols: ["37dom"],
    intervals: [0, 4, 10],
    requiredIntervals: [0, 4, 10],
    optionalIntervals: [],
    quality: ChordQuality.Dominant,
    category: ChordCategory.Seventh,
    rarity: 4,
    description: "Root, 3rd, b7 only - common jazz voicing",
  },

  {
    name: "shell minor 7",
    symbol: "shellm7",
    alternateSymbols: ["m37"],
    intervals: [0, 3, 10],
    requiredIntervals: [0, 3, 10],
    optionalIntervals: [],
    quality: ChordQuality.Minor,
    category: ChordCategory.Seventh,
    rarity: 4,
    description: "Root, b3rd, b7 only - common jazz voicing",
  },
]

/**
 * Get all chord formulas sorted by rarity (most common first)
 */
export function getFormulasByRarity(): ChordFormula[] {
  return [...CHORD_FORMULAS].sort((a, b) => a.rarity - b.rarity)
}

/**
 * Get formulas by category
 */
export function getFormulasByCategory(category: ChordCategory): ChordFormula[] {
  return CHORD_FORMULAS.filter((f) => f.category === category)
}

/**
 * Get formulas by quality
 */
export function getFormulasByQuality(quality: ChordQuality): ChordFormula[] {
  return CHORD_FORMULAS.filter((f) => f.quality === quality)
}

/**
 * Find formulas that contain specific intervals
 */
export function findFormulasWithIntervals(intervals: number[]): ChordFormula[] {
  return CHORD_FORMULAS.filter((formula) => {
    const normalizedIntervals = intervals.map((i) => i % 12)
    const formulaIntervals = formula.intervals.map((i) => i % 12)
    return normalizedIntervals.every((i) => formulaIntervals.includes(i))
  })
}
