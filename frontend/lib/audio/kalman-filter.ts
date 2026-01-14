"use client"

export interface KalmanFilterConfig {
  processNoise: number
  measurementNoise: number
  initialEstimate?: number
  initialVariance?: number
}

const DEFAULT_CONFIG: Required<KalmanFilterConfig> = {
  processNoise: 0.01,
  measurementNoise: 0.1,
  initialEstimate: 0,
  initialVariance: 1.0,
}

export class KalmanFilter {
  private x: number
  private P: number
  private Q: number
  private R: number
  private initialX: number
  private initialP: number

  constructor(config: Partial<KalmanFilterConfig> = {}) {
    const fullConfig = { ...DEFAULT_CONFIG, ...config }
    this.Q = fullConfig.processNoise
    this.R = fullConfig.measurementNoise
    this.x = fullConfig.initialEstimate
    this.P = fullConfig.initialVariance
    this.initialX = fullConfig.initialEstimate
    this.initialP = fullConfig.initialVariance
  }

  predict(): void {
    this.P = this.P + this.Q
  }

  update(measurement: number): number {
    this.predict()

    const K = this.P / (this.P + this.R)
    this.x = this.x + K * (measurement - this.x)
    this.P = (1 - K) * this.P

    return this.x
  }

  getState(): number {
    return this.x
  }

  reset(initialEstimate?: number): void {
    this.x = initialEstimate ?? this.initialX
    this.P = this.initialP
  }
}

export class StringScoreFilters {
  private filters: Map<string, KalmanFilter> = new Map()
  private config: Partial<KalmanFilterConfig>

  constructor(config: Partial<KalmanFilterConfig> = {}) {
    this.config = config
  }

  private getKey(stringNumber: number, fretNumber: number): string {
    return `${stringNumber}-${fretNumber}`
  }

  private getOrCreateFilter(stringNumber: number, fretNumber: number): KalmanFilter {
    const key = this.getKey(stringNumber, fretNumber)
    let filter = this.filters.get(key)
    if (!filter) {
      filter = new KalmanFilter(this.config)
      this.filters.set(key, filter)
    }
    return filter
  }

  updateScore(stringNumber: number, fretNumber: number, rawScore: number): number {
    const filter = this.getOrCreateFilter(stringNumber, fretNumber)
    return filter.update(rawScore)
  }

  getFilteredScore(stringNumber: number, fretNumber: number): number {
    const key = this.getKey(stringNumber, fretNumber)
    const filter = this.filters.get(key)
    return filter ? filter.getState() : 0
  }

  resetAll(): void {
    this.filters.forEach((filter) => filter.reset())
  }

  clear(): void {
    this.filters.clear()
  }
}
