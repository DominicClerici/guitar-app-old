import { NativeModule, requireNativeModule } from "expo"

export type MicrophoneStreamModuleEvents = {
  onAudioBuffer: (params: AudioBuffer) => void
}

export type AudioBuffer = {
  samples: number[]
}

declare class MicrophoneStreamModule extends NativeModule<MicrophoneStreamModuleEvents> {
  stopRecording(): void
  startRecording(): void
  getSampleRate(): number
  BUF_PER_SEC: number
}

export default requireNativeModule<MicrophoneStreamModule>("MicrophoneStream")
