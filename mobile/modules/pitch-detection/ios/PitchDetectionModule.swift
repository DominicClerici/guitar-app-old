import AVFoundation
import ExpoModulesCore

public class PitchDetectionModule: Module {

    private let audioSession = AVAudioSession.sharedInstance()
    private var audioEngine: AVAudioEngine?
    private var isCurrentlyListening = false
    private var lastUpdateTime: CFTimeInterval = 0

    // Configuration
    private var bufferSize: AVAudioFrameCount = 4096
    private var minVolume: Double = -20.0
    private var updateIntervalMs: Int = 100
    private var currentSampleRate: Double = 44100

    public func definition() -> ModuleDefinition {
        Name("PitchDetection")

        Events("onPitchDetected")

        Function("setOptions") { (bufferSize: Double, minVolume: Double, updateIntervalMs: Double) in
            self.bufferSize = AVAudioFrameCount(bufferSize)
            self.minVolume = minVolume
            self.updateIntervalMs = Int(updateIntervalMs)
        }

        Function("isListening") { () -> Bool in
            return self.isCurrentlyListening
        }

        Function("getSampleRate") { () -> Double in
            return self.currentSampleRate
        }

        AsyncFunction("startListening") { (promise: Promise) in
            #if targetEnvironment(simulator)
            promise.reject("E_NOT_SUPPORTED_ON_SIMULATOR", "Pitch detection is not supported on the iOS simulator")
            return
            #endif

            if self.isCurrentlyListening {
                promise.reject("E_ALREADY_LISTENING", "Already listening")
                return
            }

            self.audioSession.requestRecordPermission { granted in
                guard granted else {
                    promise.reject("E_PERMISSION_DENIED", "Microphone permission denied")
                    return
                }

                DispatchQueue.main.async {
                    do {
                        try self.audioSession.setCategory(.playAndRecord, mode: .measurement, options: .defaultToSpeaker)
                        try self.audioSession.setActive(true)

                        self.audioEngine = AVAudioEngine()
                        guard let audioEngine = self.audioEngine else {
                            promise.reject("E_INIT_FAILED", "Failed to initialize audio engine")
                            return
                        }

                        let inputNode = audioEngine.inputNode
                        let format = inputNode.inputFormat(forBus: 0)

                        guard format.sampleRate > 0 && format.channelCount > 0 else {
                            promise.reject("E_INVALID_FORMAT", "Invalid audio format")
                            return
                        }

                        self.currentSampleRate = format.sampleRate

                        inputNode.installTap(onBus: 0, bufferSize: self.bufferSize, format: format) { buffer, _ in
                            self.detectPitch(buffer: buffer)
                        }

                        try audioEngine.start()
                        self.isCurrentlyListening = true
                        self.lastUpdateTime = 0
                        promise.resolve(nil)

                    } catch {
                        promise.reject("E_START_FAILED", "Failed to start audio engine: \(error.localizedDescription)")
                    }
                }
            }
        }

        AsyncFunction("stopListening") { (promise: Promise) in
            if !self.isCurrentlyListening {
                promise.reject("E_NOT_LISTENING", "Not listening")
                return
            }

            self.audioEngine?.inputNode.removeTap(onBus: 0)
            self.audioEngine?.stop()
            self.audioEngine = nil
            self.isCurrentlyListening = false
            self.lastUpdateTime = 0

            try? self.audioSession.setActive(false)

            promise.resolve(nil)
        }
    }

    private func detectPitch(buffer: AVAudioPCMBuffer) {
        let currentTime = CACurrentMediaTime()
        let intervalSeconds = Double(updateIntervalMs) / 1000.0

        if lastUpdateTime == 0 || (currentTime - lastUpdateTime) >= intervalSeconds {
            guard let channelData = buffer.floatChannelData else { return }
            let frameLength = Int32(buffer.frameLength)

            // Call ObjC wrapper which calls C++ autocorrelation
            let frequency = AutoCorrelate.detectPitch(
                fromBuffer: channelData[0],
                bufferSize: frameLength,
                sampleRate: currentSampleRate,
                minVolume: minVolume
            )

            sendEvent("onPitchDetected", [
                "frequency": frequency
            ])

            lastUpdateTime = currentTime
        }
    }
}
