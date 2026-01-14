"use client"

import type { CandidateScoreInfo } from "@/lib/audio/guitar-constants"

export interface StringProbabilities {
  probabilities: number[]
  confidence: number
  dominantString: number | null
}

const NUM_STRINGS = 6
const DEFAULT_DECAY_RATE = 0.95
const MIN_PRIOR = 0.01

export class BayesianStringAccumulator {
  private priors: number[]
  private decayRate: number

  constructor(decayRate: number = DEFAULT_DECAY_RATE) {
    this.decayRate = Math.max(0.8, Math.min(0.99, decayRate))
    this.priors = this.getUniformPriors()
  }

  private getUniformPriors(): number[] {
    return new Array(NUM_STRINGS).fill(1 / NUM_STRINGS)
  }

  update(candidateScores: CandidateScoreInfo[]): StringProbabilities {
    if (candidateScores.length === 0) {
      return this.getProbabilities()
    }

    this.priors = this.priors.map((p) => MIN_PRIOR + p * (1 - MIN_PRIOR) * this.decayRate)

    const priorSum = this.priors.reduce((a, b) => a + b, 0)
    this.priors = this.priors.map((p) => p / priorSum)

    const likelihoods = new Array(NUM_STRINGS).fill(MIN_PRIOR)
    for (const candidate of candidateScores) {
      const stringIndex = candidate.stringNumber - 1
      if (stringIndex >= 0 && stringIndex < NUM_STRINGS) {
        likelihoods[stringIndex] = Math.max(likelihoods[stringIndex], candidate.totalScore)
      }
    }

    const unnormalized = this.priors.map((p, i) => p * likelihoods[i])
    const posteriorSum = unnormalized.reduce((a, b) => a + b, 0)

    if (posteriorSum > 0) {
      this.priors = unnormalized.map((p) => p / posteriorSum)
    }

    return this.getProbabilities()
  }

  reset(): void {
    this.priors = this.getUniformPriors()
  }

  getProbabilities(): StringProbabilities {
    const maxProb = Math.max(...this.priors)
    const dominantIndex = this.priors.indexOf(maxProb)

    const sortedProbs = [...this.priors].sort((a, b) => b - a)
    const secondMax = sortedProbs.length > 1 ? sortedProbs[1] : 0
    const margin = maxProb - secondMax

    const confidence = Math.min(0.95, 0.5 + margin)

    return {
      probabilities: [...this.priors],
      confidence,
      dominantString: maxProb > 1 / NUM_STRINGS ? dominantIndex + 1 : null,
    }
  }

  setDecayRate(rate: number): void {
    this.decayRate = Math.max(0.8, Math.min(0.99, rate))
  }

  getDecayRate(): number {
    return this.decayRate
  }
}
