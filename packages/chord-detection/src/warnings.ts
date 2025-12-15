/**
 * Chord Warnings Database
 *
 * This module contains rules for detecting problematic chord voicings,
 * theoretical issues, and providing musical context for unusual combinations.
 */

import { ChordQuality, ChordWarning, WarningCategory, WarningSeverity } from "./types"

/**
 * Warning rule definition
 */
export interface WarningRule {
  id: string
  name: string
  check: (intervals: number[], quality: ChordQuality) => boolean
  warning: ChordWarning
}

/**
 * All warning rules
 */
export const WARNING_RULES: WarningRule[] = [
  // ============================================================================
  // DISSONANCE WARNINGS
  // ============================================================================

  {
    id: "major-third-eleventh",
    name: "Major 3rd with Natural 11",
    check: (intervals, quality) => {
      const hasM3 = intervals.includes(4)
      const has11 = intervals.includes(5) || intervals.includes(17)
      return hasM3 && has11 && quality !== ChordQuality.Sus4
    },
    warning: {
      severity: WarningSeverity.Warning,
      category: WarningCategory.Dissonance,
      title: "Major 3rd & 11th Clash",
      message:
        "The natural 11th (4th) creates a minor 9th interval with the major 3rd, causing strong dissonance.",
      suggestion: "Consider using #11 instead, omitting the 3rd, or voicing them far apart.",
      affectedIntervals: [4, 5, 17],
    },
  },

  {
    id: "minor-second-cluster",
    name: "Minor 2nd Cluster",
    check: (intervals) => {
      // Check for any adjacent semitones
      const sorted = [...intervals].sort((a, b) => a - b)
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1]! - sorted[i]! === 1) return true
      }
      return false
    },
    warning: {
      severity: WarningSeverity.Caution,
      category: WarningCategory.Dissonance,
      title: "Minor 2nd Cluster",
      message: "Contains adjacent semitones creating a cluster voicing.",
      suggestion:
        "This can be intentional for color, but may sound harsh. Consider spreading voicing across octaves.",
      affectedIntervals: [],
    },
  },

  {
    id: "b9-root-clash",
    name: "Flat 9 Near Root",
    check: (intervals) => {
      return intervals.includes(1) || intervals.includes(13)
    },
    warning: {
      severity: WarningSeverity.Caution,
      category: WarningCategory.Dissonance,
      title: "Flat 9 Dissonance",
      message: "The b9 creates maximum dissonance with the root when voiced closely.",
      suggestion: "Works well in dominant contexts. Voice the b9 above the root for better sound.",
      affectedIntervals: [1, 13],
    },
  },

  {
    id: "major-seventh-octave-clash",
    name: "Major 7th Near Octave",
    check: (intervals) => {
      return intervals.includes(11) && intervals.includes(0)
    },
    warning: {
      severity: WarningSeverity.Info,
      category: WarningCategory.Voicing,
      title: "Major 7th Tension",
      message: "The major 7th is a semitone below the octave, creating inherent tension.",
      suggestion:
        "This is characteristic of maj7 chords. Voice the 7th below the root for a softer sound.",
      affectedIntervals: [11],
    },
  },

  // ============================================================================
  // VOICING WARNINGS
  // ============================================================================

  {
    id: "flat-six-ambiguity",
    name: "Flat 6 Ambiguity",
    check: (intervals) => {
      return intervals.includes(8)
    },
    warning: {
      severity: WarningSeverity.Caution,
      category: WarningCategory.Ambiguity,
      title: "b6 / #5 Ambiguity",
      message:
        "The interval at 8 semitones can be interpreted as a b6 or #5, leading to different chord interpretations.",
      suggestion:
        "The b6 often suggests reharmonization from a different root. Consider if the chord might be better named from another bass note.",
      affectedIntervals: [8],
    },
  },

  {
    id: "missing-third",
    name: "Missing Third",
    check: (intervals, quality) => {
      const hasThird = intervals.includes(3) || intervals.includes(4)
      const hasSus = intervals.includes(2) || intervals.includes(5)
      return (
        !hasThird &&
        !hasSus &&
        intervals.length > 2 &&
        quality !== ChordQuality.Power &&
        quality !== ChordQuality.Quartal
      )
    },
    warning: {
      severity: WarningSeverity.Info,
      category: WarningCategory.Ambiguity,
      title: "Missing Third",
      message: "No third (major or minor) is present, making the chord quality ambiguous.",
      suggestion:
        "This may be intentional for open voicings. The chord might be better classified as a sus chord or power chord.",
      affectedIntervals: [],
    },
  },

  {
    id: "missing-fifth",
    name: "Missing Fifth",
    check: (intervals) => {
      const hasFifth = intervals.includes(7)
      const hasDim5 = intervals.includes(6)
      const hasAug5 = intervals.includes(8)
      return !hasFifth && !hasDim5 && !hasAug5 && intervals.length > 2
    },
    warning: {
      severity: WarningSeverity.Info,
      category: WarningCategory.Voicing,
      title: "Missing Fifth",
      message: "The perfect 5th is omitted. This is common in jazz voicings.",
      suggestion:
        "The 5th is often the first interval to be dropped. This is perfectly acceptable.",
      affectedIntervals: [7],
    },
  },

  {
    id: "root-omission",
    name: "Possible Root Omission",
    check: (intervals) => {
      // Check if intervals suggest this might be a rootless voicing
      // e.g., E-G-Bb-D could be Cm7 without the root
      return intervals.length >= 3 && !intervals.includes(0)
    },
    warning: {
      severity: WarningSeverity.Info,
      category: WarningCategory.Voicing,
      title: "Rootless Voicing Possible",
      message: "This voicing might represent a rootless chord (common in jazz piano).",
      suggestion:
        "Check if this could be the upper structure of a different chord with the root implied by bass.",
      affectedIntervals: [],
    },
  },

  // ============================================================================
  // STYLE WARNINGS
  // ============================================================================

  {
    id: "diminished-seventh-symmetry",
    name: "Diminished 7th Symmetry",
    check: (intervals) => {
      // dim7 = 0, 3, 6, 9 - symmetrical chord
      const dim7 = [0, 3, 6, 9]
      const normalized = intervals.map((i) => i % 12)
      return dim7.every((i) => normalized.includes(i))
    },
    warning: {
      severity: WarningSeverity.Info,
      category: WarningCategory.Enharmonic,
      title: "Symmetrical Diminished 7th",
      message: "This is a symmetrical chord - it can be named from any of its four notes as root.",
      suggestion:
        "Choose the root based on the musical context, typically the bass note or the note that resolves.",
      affectedIntervals: [0, 3, 6, 9],
    },
  },

  {
    id: "augmented-symmetry",
    name: "Augmented Triad Symmetry",
    check: (intervals) => {
      // aug = 0, 4, 8 - symmetrical chord
      const aug = [0, 4, 8]
      const normalized = intervals.map((i) => i % 12)
      return aug.every((i) => normalized.includes(i)) && normalized.length === 3
    },
    warning: {
      severity: WarningSeverity.Info,
      category: WarningCategory.Enharmonic,
      title: "Symmetrical Augmented Triad",
      message:
        "This augmented triad is symmetrical - it can be named from any of its three notes as root.",
      suggestion:
        "The root is typically determined by context: the bass note or the note that functions as tonic.",
      affectedIntervals: [0, 4, 8],
    },
  },

  {
    id: "jazz-extension-without-seventh",
    name: "Extension Without 7th",
    check: (intervals) => {
      const has9or11or13 =
        intervals.includes(14) ||
        intervals.includes(17) ||
        intervals.includes(21) ||
        intervals.includes(2) ||
        intervals.includes(5) ||
        intervals.includes(9)
      const has7 = intervals.includes(10) || intervals.includes(11)
      const hasThird = intervals.includes(3) || intervals.includes(4)
      return has9or11or13 && !has7 && hasThird
    },
    warning: {
      severity: WarningSeverity.Info,
      category: WarningCategory.Style,
      title: "Extension Without 7th",
      message: "This chord has upper extensions (9, 11, or 13) but no 7th.",
      suggestion:
        'This creates an "add" chord rather than a true extended chord. Consider if "add9", "add11", etc. is the intended sound.',
      affectedIntervals: [],
    },
  },

  {
    id: "tritone-dominant",
    name: "Tritone Substitution Possibility",
    check: (intervals) => {
      // Tritone subs share the same 3-7 intervals
      const has3 = intervals.includes(4)
      const hasb7 = intervals.includes(10)
      const hasb5 = intervals.includes(6)
      return has3 && hasb7 && hasb5
    },
    warning: {
      severity: WarningSeverity.Info,
      category: WarningCategory.Enharmonic,
      title: "Tritone Substitution",
      message:
        "This chord contains the tritone found in dominant 7th chords and could function as a tritone substitution.",
      suggestion:
        "Consider the harmonic context - this might resolve like a tritone-substituted dominant.",
      affectedIntervals: [4, 6, 10],
    },
  },

  // ============================================================================
  // THEORETICAL WARNINGS
  // ============================================================================

  {
    id: "double-third",
    name: "Both Major and Minor Third",
    check: (intervals) => {
      return intervals.includes(3) && intervals.includes(4)
    },
    warning: {
      severity: WarningSeverity.Warning,
      category: WarningCategory.Theoretical,
      title: "Both Major and Minor 3rd",
      message:
        'This chord contains both a major 3rd and minor 3rd (or #9), creating a "blue note" quality.',
      suggestion:
        "This is the characteristic sound of the 7#9 (Hendrix chord). The minor 3rd is usually written as #9.",
      affectedIntervals: [3, 4],
    },
  },

  {
    id: "double-seventh",
    name: "Both Major and Minor Seventh",
    check: (intervals) => {
      return intervals.includes(10) && intervals.includes(11)
    },
    warning: {
      severity: WarningSeverity.Warning,
      category: WarningCategory.Theoretical,
      title: "Both Major and Minor 7th",
      message: "This chord contains both a major 7th and minor 7th, which is unusual.",
      suggestion:
        "This creates extreme dissonance. Consider if one note is actually a different function (13 vs b7, etc.).",
      affectedIntervals: [10, 11],
    },
  },

  {
    id: "cluster-chord",
    name: "Cluster Chord",
    check: (intervals) => {
      // Check for 3+ adjacent semitones
      const sorted = [...intervals].sort((a, b) => a - b)
      let clusterCount = 0
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1]! - sorted[i]! <= 2) {
          clusterCount++
          if (clusterCount >= 2) return true
        } else {
          clusterCount = 0
        }
      }
      return false
    },
    warning: {
      severity: WarningSeverity.Caution,
      category: WarningCategory.Style,
      title: "Cluster Voicing",
      message: "This contains a dense cluster of notes - three or more notes within a minor 3rd.",
      suggestion:
        "Cluster chords are used in modern/avant-garde music. Consider spreading the voicing if unintended.",
      affectedIntervals: [],
    },
  },

  {
    id: "avoid-note-tension",
    name: "Avoid Note Present",
    check: (intervals, quality) => {
      // In major context, natural 4 (11) is avoid note
      // In minor context, b6 is avoid note (when not specifically wanted)
      if (quality === ChordQuality.Major && (intervals.includes(5) || intervals.includes(17))) {
        return true
      }
      return false
    },
    warning: {
      severity: WarningSeverity.Caution,
      category: WarningCategory.Style,
      title: "Traditional Avoid Note",
      message: 'Contains a note traditionally considered an "avoid note" in this chord quality.',
      suggestion:
        "In traditional harmony, the natural 11 clashes with major 3rd. Modern usage often accepts or features this tension.",
      affectedIntervals: [5, 17],
    },
  },

  // ============================================================================
  // PRACTICAL WARNINGS
  // ============================================================================

  {
    id: "too-many-notes",
    name: "Dense Voicing",
    check: (intervals) => intervals.length > 6,
    warning: {
      severity: WarningSeverity.Info,
      category: WarningCategory.Practical,
      title: "Very Dense Chord",
      message: "This chord has many notes, which may be difficult to voice clearly.",
      suggestion:
        "Consider which notes are essential. In jazz, extensions often omit the root and/or 5th.",
      affectedIntervals: [],
    },
  },

  {
    id: "wide-spacing",
    name: "Wide Interval Spacing",
    check: (intervals) => {
      const sorted = [...intervals].sort((a, b) => a - b)
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1]! - sorted[i]! > 7) return true
      }
      return false
    },
    warning: {
      severity: WarningSeverity.Info,
      category: WarningCategory.Voicing,
      title: "Wide Interval Spacing",
      message: "Contains intervals larger than a perfect 5th between adjacent chord tones.",
      suggestion:
        "Wide spacing can create an open, spread voicing. This is often intentional and effective.",
      affectedIntervals: [],
    },
  },

  // ============================================================================
  // ENHARMONIC WARNINGS
  // ============================================================================

  {
    id: "enharmonic-b5-sharp11",
    name: "b5 vs #11 Ambiguity",
    check: (intervals) => {
      return intervals.includes(6) && (intervals.includes(7) || intervals.includes(8))
    },
    warning: {
      severity: WarningSeverity.Info,
      category: WarningCategory.Enharmonic,
      title: "b5 vs #11 Context",
      message: "The tritone interval present could be analyzed as b5 or #11 depending on context.",
      suggestion: "If natural 5 is present, write as #11. If 5th is altered, write as b5.",
      affectedIntervals: [6],
    },
  },

  {
    id: "enharmonic-b13-sharp5",
    name: "b13 vs #5 Ambiguity",
    check: (intervals) => {
      return intervals.includes(8) && intervals.includes(7)
    },
    warning: {
      severity: WarningSeverity.Info,
      category: WarningCategory.Enharmonic,
      title: "b13 vs #5 Context",
      message: "The minor 6th interval could be b13 (if natural 5 present) or #5.",
      suggestion:
        "With natural 5th present, the interval is typically b13. Without, it's usually #5.",
      affectedIntervals: [8],
    },
  },
]

/**
 * Get all applicable warnings for a set of intervals
 */
export function getWarningsForIntervals(
  intervals: number[],
  quality: ChordQuality,
): ChordWarning[] {
  return WARNING_RULES.filter((rule) => rule.check(intervals, quality)).map((rule) => rule.warning)
}

/**
 * Get warnings by severity
 */
export function getWarningsBySeverity(severity: WarningSeverity): WarningRule[] {
  return WARNING_RULES.filter((rule) => rule.warning.severity === severity)
}

/**
 * Get warnings by category
 */
export function getWarningsByCategory(category: WarningCategory): WarningRule[] {
  return WARNING_RULES.filter((rule) => rule.warning.category === category)
}

/**
 * Global warnings that apply to the overall identification result
 */
export function getGlobalWarnings(
  interpretationCount: number,
  intervals: number[],
): ChordWarning[] {
  const warnings: ChordWarning[] = []

  if (interpretationCount > 10) {
    warnings.push({
      severity: WarningSeverity.Info,
      category: WarningCategory.Ambiguity,
      title: "Highly Ambiguous Voicing",
      message: `This set of notes has ${interpretationCount} possible interpretations.`,
      suggestion:
        "The chord naming depends heavily on musical context. Consider the bass note and harmonic function.",
    })
  }

  if (intervals.length === 2) {
    warnings.push({
      severity: WarningSeverity.Info,
      category: WarningCategory.Ambiguity,
      title: "Two-Note Interval",
      message: "With only two notes, this is technically an interval rather than a chord.",
      suggestion:
        "True chord identification requires at least three notes for proper classification.",
    })
  }

  return warnings
}
