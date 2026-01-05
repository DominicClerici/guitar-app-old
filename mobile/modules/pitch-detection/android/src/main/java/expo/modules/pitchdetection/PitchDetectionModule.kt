package expo.modules.pitchdetection

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.concurrent.thread

class PitchDetectionModule : Module() {

    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    private var isListening = false

    private val sampleRate = 44100
    private var bufferSize = 4096
    private var minVolume = -20.0
    private var updateIntervalMs = 100

    companion object {
        init {
            System.loadLibrary("pitchdetection")
        }
    }

    private external fun nativeAutoCorrelate(buffer: ShortArray, sampleRate: Int, minVolume: Double): Double

    override fun definition() = ModuleDefinition {
        Name("PitchDetection")

        Events("onPitchDetected")

        Function("setOptions") { bufferSize: Double, minVolume: Double, updateIntervalMs: Double ->
            this@PitchDetectionModule.bufferSize = bufferSize.toInt()
            this@PitchDetectionModule.minVolume = minVolume
            this@PitchDetectionModule.updateIntervalMs = updateIntervalMs.toInt()
        }

        Function("isListening") {
            isListening
        }

        Function("getSampleRate") {
            sampleRate.toDouble()
        }

        AsyncFunction("startListening") { promise: Promise ->
            if (isListening) {
                promise.reject("E_ALREADY_LISTENING", "Already listening", null)
                return@AsyncFunction
            }

            val minBufferSize = AudioRecord.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )

            val actualBufferSize = maxOf(bufferSize, minBufferSize)

            try {
                audioRecord = AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    sampleRate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    actualBufferSize
                )

                audioRecord?.startRecording()
                isListening = true

                recordingThread = thread(start = true) {
                    val buffer = ShortArray(actualBufferSize)
                    var lastUpdateTime = System.currentTimeMillis()

                    while (isListening) {
                        val currentTime = System.currentTimeMillis()

                        if (currentTime - lastUpdateTime >= updateIntervalMs) {
                            val read = audioRecord?.read(buffer, 0, actualBufferSize) ?: 0

                            if (read > 0) {
                                val frequency = nativeAutoCorrelate(buffer.copyOf(read), sampleRate, minVolume)
                                sendEvent("onPitchDetected", mapOf("frequency" to frequency))
                                lastUpdateTime = currentTime
                            }
                        } else {
                            // Small sleep to avoid busy-waiting
                            Thread.sleep(5)
                        }
                    }
                }

                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("E_START_FAILED", "Failed to start recording: ${e.message}", e)
            }
        }

        AsyncFunction("stopListening") { promise: Promise ->
            if (!isListening) {
                promise.reject("E_NOT_LISTENING", "Not listening", null)
                return@AsyncFunction
            }

            isListening = false
            recordingThread?.interrupt()
            recordingThread = null

            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null

            promise.resolve(null)
        }
    }
}
