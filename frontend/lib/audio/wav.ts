export function createWavBlob(
  audioData: Float32Array,
  sampleRate: number,
): Blob {
  const numChannels = 1
  const bytesPerSample = 2
  const dataLength = audioData.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  const mean = audioData.reduce((a, b) => a + b, 0) / audioData.length
  const dcCorrectedData = new Float32Array(audioData.length)
  for (let i = 0; i < audioData.length; i++) {
    dcCorrectedData[i] = audioData[i] - mean
  }

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true)
  view.setUint16(34, bytesPerSample * 8, true)
  writeString(36, "data")
  view.setUint32(40, dataLength, true)

  const fadeOutSamples = Math.min(
    Math.floor(sampleRate * 0.01),
    dcCorrectedData.length,
  )
  const fadeOutStart = dcCorrectedData.length - fadeOutSamples

  let offset = 44
  for (let i = 0; i < dcCorrectedData.length; i++) {
    let s = Math.max(-1, Math.min(1, dcCorrectedData[i]))

    if (i >= fadeOutStart) {
      const fadeProgress = (i - fadeOutStart) / fadeOutSamples
      s *= 1 - fadeProgress
    }

    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: "audio/wav" })
}
