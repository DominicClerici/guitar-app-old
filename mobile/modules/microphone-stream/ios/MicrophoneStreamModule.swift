import AVFoundation
import ExpoModulesCore

let BUF_PER_SEC = 15

public class MicrophoneStreamModule: Module {

  private let audioSession = AVAudioSession.sharedInstance()
  private let audioEngine = AVAudioEngine()

  public func definition() -> ModuleDefinition {
    Name("MicrophoneStream")

    Events("onAudioBuffer")

    Constants([
      "BUF_PER_SEC": BUF_PER_SEC
    ])

    Function("startRecording") {
      self.audioSession.requestRecordPermission { granted in
        guard granted else {
          print("Microphone permission not granted.")
          return
        }

        DispatchQueue.main.async {
          do {
            try self.audioSession.setCategory(.record, mode: .measurement, options: [])
            try self.audioSession.setActive(true)

            let inputNode = self.audioEngine.inputNode
            let hwFormat = inputNode.inputFormat(forBus: 0)
            let bufferSize = AVAudioFrameCount(self.audioSession.sampleRate / Double(BUF_PER_SEC))

            inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: hwFormat) { buffer, _ in
              guard let channelData = buffer.floatChannelData else { return }
              let frameLength = Int(buffer.frameLength)
              let samples = Array(UnsafeBufferPointer(start: channelData[0], count: frameLength))
              self.sendEvent("onAudioBuffer", [
                "samples": samples
              ])
            }

            try self.audioEngine.start()
          } catch {
            print("Error configuring audio engine: \(error.localizedDescription)")
          }
        }
      }
    }

    Function("stopRecording") {
      self.stopRecording()
    }

    Function("getSampleRate") { () -> Double in
      return self.audioEngine.inputNode.inputFormat(forBus: 0).sampleRate
    }
  }

  private func stopRecording() {
    audioEngine.inputNode.removeTap(onBus: 0)
    audioEngine.stop()
    try? AVAudioSession.sharedInstance().setActive(false)
  }
}
