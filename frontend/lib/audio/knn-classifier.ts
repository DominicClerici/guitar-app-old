export interface TrainingSample {
  stringNumber: number
  features: number[]
}

export interface PredictionResult {
  predictedString: number
  confidence: number
  allConfidences: Record<number, number>
  nearestNeighbors: Array<{ stringNumber: number; distance: number }>
}

export interface KNNModel {
  k: number
  samples: TrainingSample[]
  normalization: {
    means: number[]
    stds: number[]
  }
}

export class KNNClassifier {
  private k: number
  private samples: TrainingSample[] = []
  private means: number[] = []
  private stds: number[] = []
  private normalized: number[][] = []

  constructor(k = 5) {
    this.k = k
  }

  train(samples: TrainingSample[]): void {
    if (samples.length === 0) {
      throw new Error("Cannot train with empty samples")
    }

    this.samples = samples
    this.computeNormalizationParams()
    this.normalizeAllSamples()
  }

  private computeNormalizationParams(): void {
    const featureCount = this.samples[0].features.length
    const n = this.samples.length

    this.means = new Array(featureCount).fill(0)
    this.stds = new Array(featureCount).fill(0)

    for (let i = 0; i < n; i++) {
      const features = this.samples[i].features
      for (let j = 0; j < featureCount; j++) {
        this.means[j] += features[j]
      }
    }

    for (let j = 0; j < featureCount; j++) {
      this.means[j] /= n
    }

    for (let i = 0; i < n; i++) {
      const features = this.samples[i].features
      for (let j = 0; j < featureCount; j++) {
        const diff = features[j] - this.means[j]
        this.stds[j] += diff * diff
      }
    }

    for (let j = 0; j < featureCount; j++) {
      this.stds[j] = Math.sqrt(this.stds[j] / n)
      if (this.stds[j] === 0) {
        this.stds[j] = 1
      }
    }
  }

  private normalizeAllSamples(): void {
    this.normalized = new Array(this.samples.length)
    for (let i = 0; i < this.samples.length; i++) {
      this.normalized[i] = this.normalizeFeatures(this.samples[i].features)
    }
  }

  private normalizeFeatures(features: number[]): number[] {
    const result = new Array(features.length)
    for (let i = 0; i < features.length; i++) {
      result[i] = (features[i] - this.means[i]) / this.stds[i]
    }
    return result
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i]
      sum += diff * diff
    }
    return Math.sqrt(sum)
  }

  predict(features: number[]): PredictionResult {
    if (this.samples.length === 0) {
      throw new Error("Classifier has no training samples")
    }

    if (features.length !== this.means.length) {
      throw new Error(
        `Feature length mismatch: expected ${this.means.length}, got ${features.length}`
      )
    }

    const normalizedInput = this.normalizeFeatures(features)

    const distances: Array<{ index: number; distance: number }> = new Array(
      this.samples.length
    )

    for (let i = 0; i < this.samples.length; i++) {
      distances[i] = {
        index: i,
        distance: this.euclideanDistance(normalizedInput, this.normalized[i]),
      }
    }

    distances.sort((a, b) => a.distance - b.distance)

    const effectiveK = Math.min(this.k, this.samples.length)
    const nearestNeighbors: Array<{ stringNumber: number; distance: number }> =
      new Array(effectiveK)

    for (let i = 0; i < effectiveK; i++) {
      nearestNeighbors[i] = {
        stringNumber: this.samples[distances[i].index].stringNumber,
        distance: distances[i].distance,
      }
    }

    // Weighted voting: weight = 1 / (distance + epsilon) to avoid division by zero
    const epsilon = 1e-10
    const votes: Record<number, number> = {}
    let totalWeight = 0

    for (let i = 0; i < effectiveK; i++) {
      const stringNum = nearestNeighbors[i].stringNumber
      const weight = 1 / (nearestNeighbors[i].distance + epsilon)
      votes[stringNum] = (votes[stringNum] || 0) + weight
      totalWeight += weight
    }

    let predictedString = 1
    let maxVote = 0

    const allConfidences: Record<number, number> = {}

    for (let s = 1; s <= 6; s++) {
      const vote = votes[s] || 0
      allConfidences[s] = vote / totalWeight

      if (vote > maxVote) {
        maxVote = vote
        predictedString = s
      }
    }

    return {
      predictedString,
      confidence: allConfidences[predictedString],
      allConfidences,
      nearestNeighbors,
    }
  }

  addSample(sample: TrainingSample): void {
    this.samples.push(sample)

    if (this.samples.length === 1) {
      this.means = [...sample.features]
      this.stds = new Array(sample.features.length).fill(1)
      this.normalized = [this.normalizeFeatures(sample.features)]
    } else {
      this.computeNormalizationParams()
      this.normalizeAllSamples()
    }
  }

  removeSamplesForString(stringNumber: number): void {
    const originalLength = this.samples.length
    this.samples = this.samples.filter((s) => s.stringNumber !== stringNumber)

    if (this.samples.length !== originalLength && this.samples.length > 0) {
      this.computeNormalizationParams()
      this.normalizeAllSamples()
    } else if (this.samples.length === 0) {
      this.means = []
      this.stds = []
      this.normalized = []
    }
  }

  exportModel(): KNNModel {
    return {
      k: this.k,
      samples: this.samples.map((s) => ({
        stringNumber: s.stringNumber,
        features: [...s.features],
      })),
      normalization: {
        means: [...this.means],
        stds: [...this.stds],
      },
    }
  }

  importModel(model: KNNModel): void {
    this.k = model.k
    this.samples = model.samples.map((s) => ({
      stringNumber: s.stringNumber,
      features: [...s.features],
    }))
    this.means = [...model.normalization.means]
    this.stds = [...model.normalization.stds]
    this.normalizeAllSamples()
  }

  get sampleCount(): number {
    return this.samples.length
  }

  get samplesPerString(): Record<number, number> {
    const counts: Record<number, number> = {}
    for (let s = 1; s <= 6; s++) {
      counts[s] = 0
    }
    for (const sample of this.samples) {
      counts[sample.stringNumber] = (counts[sample.stringNumber] || 0) + 1
    }
    return counts
  }
}
