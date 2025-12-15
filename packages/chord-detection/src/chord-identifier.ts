/**
 * Chord Identifier Engine
 *
 * The main identification engine that matches note sets against chord formulas,
 * calculates confidence scores, and generates interpretations.
 */

import {
  ChordCategory,
  ChordFormula,
  ChordIdentificationResult,
  ChordIdentifierOptions,
  ChordInterpretation,
  Note,
  PitchClass,
  WarningCategory,
  WarningSeverity,
} from "./types"

import { getFormulasByRarity } from "./formulas"
import {
  formatNote,
  getInterval,
  getPitchClassName,
  getUniquePitchClasses,
  inputPrefersFlats,
  normalizeIntervals,
  parseNotes,
  validateNoteCount,
} from "./note-parser"
import { getGlobalWarnings, getWarningsForIntervals } from "./warnings"

const DEFAULT_OPTIONS: Required<ChordIdentifierOptions> = {
  maxInterpretations: 20,
  includeSlashChords: true,
  includePolychords: false,
  preferFlats: false,
  preferSharps: false,
  jazzMode: false,
  classicalMode: false,
  strictMode: false,
  includeTheoreticalChords: true,
  minConfidence: 20,
}

export class ChordIdentifier {
  private options: Required<ChordIdentifierOptions>
  private formulas: ChordFormula[]

  constructor(options: ChordIdentifierOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.formulas = this.prepareFormulas()
  }

  private prepareFormulas(): ChordFormula[] {
    let formulas = getFormulasByRarity()

    if (!this.options.includeTheoreticalChords) {
      formulas = formulas.filter((f) => f.rarity <= 6)
    }

    if (this.options.classicalMode) {
      formulas = formulas.filter(
        (f) =>
          f.category === ChordCategory.Triad ||
          f.category === ChordCategory.Seventh ||
          f.category === ChordCategory.Suspended,
      )
    }

    return formulas
  }

  identify(input: string | string[] | Note[]): ChordIdentificationResult {
    const startTime = performance.now()

    let notes: Note[]
    if (typeof input === "string" || (Array.isArray(input) && typeof input[0] === "string")) {
      notes = parseNotes(input as string | string[])
    } else {
      notes = input as Note[]
    }

    const validation = validateNoteCount(notes)
    if (!validation.valid) {
      return {
        inputNotes: notes,
        interpretations: [],
        globalWarnings: [
          {
            severity: WarningSeverity.Critical,
            category: WarningCategory.Practical,
            title: "Insufficient Notes",
            message: validation.message || "Not enough notes for chord identification",
          },
        ],
        isValidChord: false,
        processingTime: performance.now() - startTime,
      }
    }

    const uniquePitches = getUniquePitchClasses(notes)
    const preferFlat =
      this.options.preferFlats || (!this.options.preferSharps && inputPrefersFlats(notes))

    const interpretations: ChordInterpretation[] = []

    for (const rootPitch of uniquePitches) {
      const rootNote: Note = {
        pitchClass: rootPitch,
        originalName: getPitchClassName(rootPitch, preferFlat),
        preferFlat,
      }

      const intervals = uniquePitches
        .map((pitch) => {
          let interval = pitch - rootPitch
          if (interval < 0) interval += 12
          return interval
        })
        .sort((a, b) => a - b)

      const matches = this.matchFormulas(intervals, rootNote, notes, preferFlat)
      interpretations.push(...matches)
    }

    if (this.options.includeSlashChords && notes.length >= 3) {
      const slashInterpretations = this.findSlashChords(notes, uniquePitches, preferFlat)
      interpretations.push(...slashInterpretations)
    }

    interpretations.sort((a, b) => b.confidence - a.confidence)
    const filtered = interpretations.filter((i) => i.confidence >= this.options.minConfidence)
    const limited = filtered.slice(0, this.options.maxInterpretations)
    const globalWarnings = getGlobalWarnings(
      interpretations.length,
      uniquePitches.map((p) => p),
    )

    return {
      inputNotes: notes,
      interpretations: limited,
      globalWarnings,
      isValidChord: limited.length > 0,
      processingTime: performance.now() - startTime,
    }
  }

  private matchFormulas(
    intervals: number[],
    rootNote: Note,
    originalNotes: Note[],
    preferFlat: boolean,
  ): ChordInterpretation[] {
    const interpretations: ChordInterpretation[] = []
    const normalizedInput = normalizeIntervals(intervals)

    for (const formula of this.formulas) {
      const normalizedFormula = normalizeIntervals(formula.intervals)
      const match = this.calculateMatch(normalizedInput, normalizedFormula, formula)

      if (match.isMatch) {
        const interpretation = this.createInterpretation(
          rootNote,
          formula,
          intervals,
          match,
          originalNotes,
          preferFlat,
        )
        interpretations.push(interpretation)
      }
    }

    return interpretations
  }

  private calculateMatch(
    input: number[],
    formula: number[],
    chordFormula: ChordFormula,
  ): {
    isMatch: boolean
    presentIntervals: number[]
    missingIntervals: number[]
    extraNotes: number[]
    matchScore: number
  } {
    const presentIntervals: number[] = []
    const missingIntervals: number[] = []
    const extraNotes: number[] = []

    const inputSet = new Set(input.map((i) => i % 12))
    const formulaSet = new Set(formula.map((i) => i % 12))
    const requiredSet = new Set(chordFormula.requiredIntervals.map((i) => i % 12))
    const optionalSet = new Set(chordFormula.optionalIntervals.map((i) => i % 12))

    for (const interval of Array.from(formulaSet)) {
      if (inputSet.has(interval)) {
        presentIntervals.push(interval)
      } else {
        missingIntervals.push(interval)
      }
    }

    for (const interval of Array.from(inputSet)) {
      if (!formulaSet.has(interval)) {
        extraNotes.push(interval)
      }
    }

    const hasAllRequired = Array.from(requiredSet).every((i) => inputSet.has(i))

    if (this.options.strictMode) {
      const isExact =
        inputSet.size === formulaSet.size && Array.from(inputSet).every((i) => formulaSet.has(i))
      return {
        isMatch: isExact,
        presentIntervals,
        missingIntervals,
        extraNotes,
        matchScore: isExact ? 100 : 0,
      }
    }

    const isMatch =
      hasAllRequired &&
      (missingIntervals.every((i) => optionalSet.has(i)) || missingIntervals.length === 0)

    let matchScore = 0
    if (isMatch) {
      matchScore = 50
      const coverageRatio = presentIntervals.length / formula.length
      matchScore += coverageRatio * 30
      matchScore -= extraNotes.length * 5
      if (extraNotes.length === 0 && missingIntervals.length === 0) {
        matchScore += 20
      }
      matchScore = Math.max(0, Math.min(100, matchScore))
    }

    return { isMatch, presentIntervals, missingIntervals, extraNotes, matchScore }
  }

  private createInterpretation(
    root: Note,
    formula: ChordFormula,
    intervals: number[],
    match: {
      presentIntervals: number[]
      missingIntervals: number[]
      extraNotes: number[]
      matchScore: number
    },
    originalNotes: Note[],
    preferFlat: boolean,
  ): ChordInterpretation {
    const rootName = getPitchClassName(root.pitchClass, preferFlat)
    const bassNote = originalNotes[0]
    const bassInterval = bassNote ? getInterval(root, bassNote) : 0
    const inversion = this.calculateInversion(bassInterval, formula)

    const symbol = rootName + formula.symbol
    const alternateSymbols = formula.alternateSymbols.map((s) => rootName + s)
    const fullName = `${rootName} ${formula.name}`
    const voicingNotes = originalNotes.map((n) => formatNote(n, preferFlat))

    let confidence = match.matchScore
    confidence = this.adjustConfidence(confidence, formula, match, inversion)

    const warnings = getWarningsForIntervals(intervals, formula.quality)

    if (inversion > 0) {
      warnings.push({
        severity: WarningSeverity.Info,
        category: WarningCategory.Voicing,
        title: `${this.getInversionName(inversion)} Inversion`,
        message: `The chord is in ${this.getInversionName(inversion).toLowerCase()} inversion with ${getPitchClassName(bassNote?.pitchClass ?? PitchClass.C, preferFlat)} in the bass.`,
        suggestion: "Consider if a slash chord notation might be clearer.",
      })
    }

    return {
      root,
      formula,
      presentIntervals: match.presentIntervals,
      missingIntervals: match.missingIntervals,
      extraNotes: match.extraNotes,
      inversion,
      confidence: Math.round(confidence),
      fullName,
      symbol,
      alternateSymbols,
      warnings,
      voicingNotes,
    }
  }

  private calculateInversion(bassInterval: number, formula: ChordFormula): number {
    if (bassInterval === 0) return 0
    const sortedIntervals = [...formula.intervals].sort((a, b) => a - b)
    const index = sortedIntervals.findIndex((i) => i % 12 === bassInterval % 12)
    return index >= 0 ? index : 0
  }

  private getInversionName(inversion: number): string {
    const names = ["Root Position", "First", "Second", "Third", "Fourth", "Fifth", "Sixth"]
    return names[inversion] || `${inversion}th`
  }

  private adjustConfidence(
    baseConfidence: number,
    formula: ChordFormula,
    match: { extraNotes: number[]; missingIntervals: number[] },
    inversion: number,
  ): number {
    let confidence = baseConfidence
    confidence -= (formula.rarity - 1) * 3
    confidence -= inversion * 2

    if (this.options.jazzMode) {
      if (
        formula.category === ChordCategory.Extended ||
        formula.category === ChordCategory.Altered
      ) {
        confidence += 10
      }
      if (match.missingIntervals.includes(7)) {
        confidence += 5
      }
    }

    if (this.options.classicalMode) {
      if (formula.category === ChordCategory.Triad) {
        confidence += 10
      }
    }

    const extraPenalty = match.extraNotes.reduce((sum, _, i) => sum + Math.max(5 - i, 1), 0)
    confidence -= extraPenalty
    confidence -= match.missingIntervals.length * 3

    return Math.max(0, Math.min(100, confidence))
  }

  private findSlashChords(
    notes: Note[],
    uniquePitches: PitchClass[],
    preferFlat: boolean,
  ): ChordInterpretation[] {
    const interpretations: ChordInterpretation[] = []
    const bassNote = notes[0]
    const upperPitches = uniquePitches.filter((p) => p !== bassNote?.pitchClass)

    if (upperPitches.length < 2) return interpretations

    for (const rootPitch of upperPitches) {
      const rootNote: Note = {
        pitchClass: rootPitch,
        originalName: getPitchClassName(rootPitch, preferFlat),
        preferFlat,
      }

      const intervals = upperPitches
        .map((pitch) => {
          let interval = pitch - rootPitch
          if (interval < 0) interval += 12
          return interval
        })
        .sort((a, b) => a - b)

      const simpleFormulas = this.formulas.filter(
        (f) => f.category === ChordCategory.Triad || f.category === ChordCategory.Seventh,
      )

      for (const formula of simpleFormulas) {
        const normalizedInput = normalizeIntervals(intervals)
        const normalizedFormula = normalizeIntervals(formula.intervals)
        const match = this.calculateMatch(normalizedInput, normalizedFormula, formula)

        if (match.isMatch && match.matchScore > 50) {
          const rootName = getPitchClassName(rootPitch, preferFlat)
          const bassName = getPitchClassName(bassNote?.pitchClass ?? PitchClass.C, preferFlat)

          const interpretation: ChordInterpretation = {
            root: rootNote,
            bass: bassNote!,
            formula,
            presentIntervals: match.presentIntervals,
            missingIntervals: match.missingIntervals,
            extraNotes: match.extraNotes,
            inversion: 0,
            confidence: Math.round(match.matchScore * 0.85),
            fullName: `${rootName} ${formula.name} over ${bassName}`,
            symbol: `${rootName}${formula.symbol}/${bassName}`,
            alternateSymbols: formula.alternateSymbols.map((s) => `${rootName}${s}/${bassName}`),
            warnings: [
              {
                severity: WarningSeverity.Info,
                category: WarningCategory.Voicing,
                title: "Slash Chord",
                message: `This is a ${rootName}${formula.symbol} chord with ${bassName} in the bass.`,
                suggestion: "Slash chords are common in pop, jazz, and contemporary music.",
              },
            ],
            voicingNotes: notes.map((n) => formatNote(n, preferFlat)),
          }
          interpretations.push(interpretation)
        }
      }
    }

    return interpretations
  }

  static identify(input: string | string[]): ChordIdentificationResult {
    const identifier = new ChordIdentifier()
    return identifier.identify(input)
  }

  static getTopChord(input: string | string[]): string | null {
    const result = ChordIdentifier.identify(input)
    return result.interpretations[0]?.symbol || null
  }

  static getAllChordNames(input: string | string[]): string[] {
    const result = ChordIdentifier.identify(input)
    return result.interpretations.map((i) => i.symbol)
  }
}

export function identifyChord(input: string | string[]): ChordIdentificationResult {
  return ChordIdentifier.identify(input)
}

export function getChordName(input: string | string[]): string | null {
  return ChordIdentifier.getTopChord(input)
}

export function getAllChordNames(input: string | string[]): string[] {
  return ChordIdentifier.getAllChordNames(input)
}
