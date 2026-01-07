import { NativeModule, requireNativeModule } from "expo"

export type PitchDetectionModuleEvents = {
  onPitchDetected: (params: PitchEvent) => void
}

export type PitchEvent = {
  frequency: number
}

/**
 * Pitch detection algorithm selection.
 * - Autocorrelation: Standard autocorrelation algorithm (default)
 * - BitstreamAutocorrelation: Fast bitstream-based algorithm using XOR operations
 */
export enum PitchAlgorithm {
  /** Standard autocorrelation - more accurate but slower */
  Autocorrelation = 0,
  /** Bitstream autocorrelation - 32-64x faster, good for low latency */
  BitstreamAutocorrelation = 1,
}

export type PitchDetectionOptions = {
  /** Buffer size for audio capture. Default: 4096 */
  bufferSize?: number
  /** Minimum volume in decibels to trigger detection. Default: -20.0 */
  minVolume?: number
  /** Update interval in milliseconds. Default: 100 */
  updateIntervalMs?: number
  /** Pitch detection algorithm. Default: Autocorrelation */
  algorithm?: PitchAlgorithm
}

declare class PitchDetectionModule extends NativeModule<PitchDetectionModuleEvents> {
  /**
   * Configure detection options before starting
   */
  setOptions(bufferSize: number, minVolume: number, updateIntervalMs: number): void

  /**
   * Set the pitch detection algorithm
   * @param algorithm 0 = Autocorrelation, 1 = BitstreamAutocorrelation
   */
  setAlgorithm(algorithm: number): void

  /**
   * Start listening for pitch
   */
  startListening(): Promise<void>

  /**
   * Stop listening
   */
  stopListening(): Promise<void>

  /**
   * Check if currently listening
   */
  isListening(): boolean

  /**
   * Get the current sample rate
   */
  getSampleRate(): number
}

export default requireNativeModule<PitchDetectionModule>("PitchDetection")
