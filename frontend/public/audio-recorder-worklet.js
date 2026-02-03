class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.isActive = false
    this.ringBuffer = null
    this.ringBufferSize = 0
    this.writeIndex = 0
    this.phase = "idle" // "waiting-for-silence" | "ready-to-pluck" | "recording"
    this.samplesAfterPluck = 0
    this.samplesToRecordAfterPluck = 0
    this.preRollSamples = 0
    this.silenceThreshold = 0.01
    this.pluckThreshold = 0.015
    this.pluckSampleIndex = 0
    this.consecutiveSilentFrames = 0
    this.requiredSilentFrames = 20 // ~50ms at 48kHz with 128-sample frames

    this.port.onmessage = (event) => {
      const { type, data } = event.data

      switch (type) {
        case "start-capture":
          this.preRollSamples = data.preRollSamples
          this.samplesToRecordAfterPluck = data.samplesToRecord
          this.silenceThreshold = data.silenceThreshold
          this.pluckThreshold = data.pluckThreshold
          this.ringBufferSize = this.preRollSamples + this.samplesToRecordAfterPluck + 8192
          this.ringBuffer = new Float32Array(this.ringBufferSize)
          this.writeIndex = 0
          this.phase = "waiting-for-silence"
          this.samplesAfterPluck = 0
          this.pluckSampleIndex = 0
          this.consecutiveSilentFrames = 0
          this.isActive = true
          break

        case "cancel":
          this.isActive = false
          this.phase = "idle"
          this.ringBuffer = null
          break
      }
    }
  }

  computeAmplitude(channelData) {
    let sum = 0
    for (let i = 0; i < channelData.length; i++) {
      sum += Math.abs(channelData[i])
    }
    return sum / channelData.length
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true

    const channelData = input[0]

    if (!this.isActive || !this.ringBuffer) return true

    const amplitude = this.computeAmplitude(channelData)

    // Write samples to ring buffer
    for (let i = 0; i < channelData.length; i++) {
      this.ringBuffer[this.writeIndex] = channelData[i]
      this.writeIndex = (this.writeIndex + 1) % this.ringBufferSize
    }

    if (this.phase === "waiting-for-silence") {
      if (amplitude < this.silenceThreshold) {
        this.consecutiveSilentFrames++
        if (this.consecutiveSilentFrames >= this.requiredSilentFrames) {
          this.phase = "ready-to-pluck"
          this.port.postMessage({ type: "phase-change", data: { phase: "ready-to-pluck" } })
        }
      } else {
        this.consecutiveSilentFrames = 0
      }
    } else if (this.phase === "ready-to-pluck") {
      // Find exact sample where pluck occurs for sample-accurate timing
      for (let i = 0; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) > this.pluckThreshold) {
          this.phase = "recording"
          this.pluckSampleIndex = i
          // Adjust samplesAfterPluck to account for samples already in this block after the pluck
          this.samplesAfterPluck = channelData.length - i
          this.port.postMessage({ type: "phase-change", data: { phase: "recording" } })
          break
        }
      }
    } else if (this.phase === "recording") {
      this.samplesAfterPluck += channelData.length

      if (this.samplesAfterPluck >= this.samplesToRecordAfterPluck) {
        const totalSamples = this.preRollSamples + this.samplesToRecordAfterPluck
        const audioData = new Float32Array(totalSamples)

        // Calculate read start position accounting for exact pluck position
        let readIndex = this.writeIndex - totalSamples
        if (readIndex < 0) {
          readIndex += this.ringBufferSize
        }

        for (let i = 0; i < totalSamples; i++) {
          audioData[i] = this.ringBuffer[readIndex]
          readIndex = (readIndex + 1) % this.ringBufferSize
        }

        this.port.postMessage({
          type: "recording-complete",
          data: { audioData },
        })

        this.isActive = false
        this.phase = "idle"
      }
    }

    return true
  }
}

registerProcessor("audio-recorder-processor", AudioRecorderProcessor)
