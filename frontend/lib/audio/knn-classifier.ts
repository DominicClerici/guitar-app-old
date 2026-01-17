"use client"

export interface TrainingSample {
  features: number[]
  label: number
  metadata?: {
    fret?: number
    timestamp?: number
  }
}

export interface NormalizationParams {
  means: number[]
  stds: number[]
}

export interface ClassificationResult {
  predictedClass: number
  confidence: number
  probabilities: Map<number, number>
  nearestNeighbors: Array<{
    label: number
    distance: number
  }>
}

export interface KNNModelData {
  samples: TrainingSample[]
  normalization: NormalizationParams | null
  k: number
  featureCount: number
  version: string
}

const MODEL_VERSION = "1.0.0"
const STORAGE_KEY = "spectral-string-detection-model"

export class KNNClassifier {
  private samples: TrainingSample[] = []
  private normalization: NormalizationParams | null = null
  private k: number
  private featureCount: number = 0

  constructor(k: number = 5) {
    this.k = k
  }

  addSample(features: number[], label: number, metadata?: { fret?: number }): void {
    if (this.featureCount === 0) {
      this.featureCount = features.length
    } else if (features.length !== this.featureCount) {
      throw new Error(
        `Feature count mismatch: expected ${this.featureCount}, got ${features.length}`
      )
    }

    this.samples.push({
      features: [...features],
      label,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
      },
    })

    this.normalization = null
  }

  addSamples(samples: Array<{ features: number[]; label: number; fret?: number }>): void {
    for (const sample of samples) {
      this.addSample(sample.features, sample.label, { fret: sample.fret })
    }
  }

  private computeNormalization(): void {
    if (this.samples.length === 0) {
      this.normalization = null
      return
    }

    const n = this.samples.length
    const means = new Array(this.featureCount).fill(0)
    const stds = new Array(this.featureCount).fill(0)

    for (const sample of this.samples) {
      for (let i = 0; i < this.featureCount; i++) {
        means[i] += sample.features[i]
      }
    }
    for (let i = 0; i < this.featureCount; i++) {
      means[i] /= n
    }

    for (const sample of this.samples) {
      for (let i = 0; i < this.featureCount; i++) {
        const diff = sample.features[i] - means[i]
        stds[i] += diff * diff
      }
    }
    for (let i = 0; i < this.featureCount; i++) {
      stds[i] = Math.sqrt(stds[i] / n)
      if (stds[i] < 1e-10) stds[i] = 1
    }

    this.normalization = { means, stds }
  }

  private normalize(features: number[]): number[] {
    if (!this.normalization) {
      return features
    }

    return features.map(
      (f, i) => (f - this.normalization!.means[i]) / this.normalization!.stds[i]
    )
  }

  train(): void {
    if (this.samples.length === 0) {
      throw new Error("No training samples available")
    }
    this.computeNormalization()
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i]
      sum += diff * diff
    }
    return Math.sqrt(sum)
  }

  classify(features: number[]): ClassificationResult | null {
    if (this.samples.length === 0) {
      return null
    }

    if (features.length !== this.featureCount) {
      throw new Error(
        `Feature count mismatch: expected ${this.featureCount}, got ${features.length}`
      )
    }

    if (!this.normalization) {
      this.train()
    }

    const normalizedInput = this.normalize(features)

    const distances: Array<{ label: number; distance: number }> = []

    for (const sample of this.samples) {
      const normalizedSample = this.normalize(sample.features)
      const distance = this.euclideanDistance(normalizedInput, normalizedSample)
      distances.push({ label: sample.label, distance })
    }

    distances.sort((a, b) => a.distance - b.distance)

    const k = Math.min(this.k, distances.length)
    const nearestNeighbors = distances.slice(0, k)

    const votes = new Map<number, number>()
    const weightedVotes = new Map<number, number>()

    for (const neighbor of nearestNeighbors) {
      votes.set(neighbor.label, (votes.get(neighbor.label) || 0) + 1)

      const weight = 1 / (neighbor.distance + 1e-10)
      weightedVotes.set(neighbor.label, (weightedVotes.get(neighbor.label) || 0) + weight)
    }

    let predictedClass = -1
    let maxWeight = -Infinity
    for (const [label, weight] of weightedVotes) {
      if (weight > maxWeight) {
        maxWeight = weight
        predictedClass = label
      }
    }

    let totalWeight = 0
    for (const weight of weightedVotes.values()) {
      totalWeight += weight
    }

    const probabilities = new Map<number, number>()
    for (const [label, weight] of weightedVotes) {
      probabilities.set(label, weight / totalWeight)
    }

    const confidence = probabilities.get(predictedClass) || 0

    return {
      predictedClass,
      confidence,
      probabilities,
      nearestNeighbors,
    }
  }

  getSampleCount(): number {
    return this.samples.length
  }

  getSampleCountByClass(): Map<number, number> {
    const counts = new Map<number, number>()
    for (const sample of this.samples) {
      counts.set(sample.label, (counts.get(sample.label) || 0) + 1)
    }
    return counts
  }

  getClasses(): number[] {
    return [...new Set(this.samples.map((s) => s.label))].sort((a, b) => a - b)
  }

  setK(k: number): void {
    if (k < 1) throw new Error("k must be at least 1")
    this.k = k
  }

  getK(): number {
    return this.k
  }

  clearSamples(): void {
    this.samples = []
    this.normalization = null
    this.featureCount = 0
  }

  removeSamplesByClass(label: number): void {
    this.samples = this.samples.filter((s) => s.label !== label)
    this.normalization = null
  }

  exportModel(): KNNModelData {
    return {
      samples: this.samples.map((s) => ({
        features: [...s.features],
        label: s.label,
        metadata: s.metadata ? { ...s.metadata } : undefined,
      })),
      normalization: this.normalization
        ? {
            means: [...this.normalization.means],
            stds: [...this.normalization.stds],
          }
        : null,
      k: this.k,
      featureCount: this.featureCount,
      version: MODEL_VERSION,
    }
  }

  importModel(data: KNNModelData): void {
    if (data.version !== MODEL_VERSION) {
      console.warn(`Model version mismatch: expected ${MODEL_VERSION}, got ${data.version}`)
    }

    this.samples = data.samples.map((s) => ({
      features: [...s.features],
      label: s.label,
      metadata: s.metadata ? { ...s.metadata } : undefined,
    }))

    this.normalization = data.normalization
      ? {
          means: [...data.normalization.means],
          stds: [...data.normalization.stds],
        }
      : null

    this.k = data.k
    this.featureCount = data.featureCount
  }

  saveToStorage(): void {
    try {
      const data = this.exportModel()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error("Failed to save model to localStorage:", e)
    }
  }

  loadFromStorage(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return false

      const data: KNNModelData = JSON.parse(stored)
      this.importModel(data)
      return true
    } catch (e) {
      console.error("Failed to load model from localStorage:", e)
      return false
    }
  }

  static clearStorage(): void {
    localStorage.removeItem(STORAGE_KEY)
  }

  crossValidate(folds: number = 5): { accuracy: number; confusionMatrix: Map<number, Map<number, number>> } {
    if (this.samples.length < folds) {
      throw new Error(`Not enough samples for ${folds}-fold cross-validation`)
    }

    const shuffled = [...this.samples].sort(() => Math.random() - 0.5)
    const foldSize = Math.floor(shuffled.length / folds)

    let correct = 0
    let total = 0
    const confusionMatrix = new Map<number, Map<number, number>>()

    for (let fold = 0; fold < folds; fold++) {
      const testStart = fold * foldSize
      const testEnd = fold === folds - 1 ? shuffled.length : (fold + 1) * foldSize

      const testSet = shuffled.slice(testStart, testEnd)
      const trainSet = [...shuffled.slice(0, testStart), ...shuffled.slice(testEnd)]

      const tempClassifier = new KNNClassifier(this.k)
      tempClassifier.addSamples(
        trainSet.map((s) => ({ features: s.features, label: s.label, fret: s.metadata?.fret }))
      )
      tempClassifier.train()

      for (const sample of testSet) {
        const result = tempClassifier.classify(sample.features)
        if (result) {
          if (result.predictedClass === sample.label) {
            correct++
          }
          total++

          if (!confusionMatrix.has(sample.label)) {
            confusionMatrix.set(sample.label, new Map())
          }
          const row = confusionMatrix.get(sample.label)!
          row.set(result.predictedClass, (row.get(result.predictedClass) || 0) + 1)
        }
      }
    }

    return {
      accuracy: total > 0 ? correct / total : 0,
      confusionMatrix,
    }
  }
}

export function createClassifier(k: number = 5): KNNClassifier {
  return new KNNClassifier(k)
}
