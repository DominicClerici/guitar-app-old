import { NativeModule, requireNativeModule } from "expo"

export type PitchDetectionModuleEvents = {
  onPitchDetected: (params: PitchEvent) => void
}

export type PitchEvent = {
  frequency: number
}

export type PitchDetectionOptions = {
  /** Buffer size for audio capture. Default: 4096 */
  bufferSize?: number
  /** Minimum volume in decibels to trigger detection. Default: -20.0 */
  minVolume?: number
  /** Update interval in milliseconds. Default: 100 */
  updateIntervalMs?: number
}

declare class PitchDetectionModule extends NativeModule<PitchDetectionModuleEvents> {
  /**
   * Configure detection options before starting
   */
  setOptions(bufferSize: number, minVolume: number, updateIntervalMs: number): void

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
