import { Sampler } from "tone"

// format test
type NoteSamples = Record<string, string>

export type InstrumentName = "guitar-12-string" | "guitar-acoustic" | "guitar-classical"

// Instruments that have stereo samples (left and right channels)
export const STEREO_INSTRUMENTS: InstrumentName[] = ["guitar-acoustic", "guitar-classical"]
interface LoadOptions {
  instruments?: InstrumentName
  baseUrl?: string
  onload?: (() => void) | null
  minify?: boolean
  volume?: number // Volume in dB (default 0)
}

export type StereoSamplers = {
  left: Sampler
  right: Sampler
}

export type LoadResult = Sampler | StereoSamplers

export function isStereoSamplers(result: LoadResult): result is StereoSamplers {
  return (result as StereoSamplers).left !== undefined
}

interface SampleLibraryType {
  minify: boolean
  baseUrl: string
  list: InstrumentName[]
  onload: (() => void) | null
  load(arg?: LoadOptions): Promise<LoadResult>
  "guitar-12-string": NoteSamples
  "guitar-acoustic": NoteSamples
  "guitar-acoustic-left": NoteSamples
  "guitar-classical": NoteSamples
  "guitar-classical-left": NoteSamples
}

export const SampleLibrary: SampleLibraryType = {
  minify: false,
  baseUrl: "/samples/",
  list: ["guitar-acoustic", "guitar-classical", "guitar-12-string"],
  onload: null,

  async load(arg?: LoadOptions): Promise<LoadResult> {
    const options = {
      instruments: arg?.instruments ?? this.list[0],
      baseUrl: arg?.baseUrl ?? this.baseUrl,
      onload: arg?.onload ?? this.onload,
      minify: arg?.minify ?? false,
      volume: arg?.volume ?? 0,
    }

    const minifySamples = (samples: NoteSamples): NoteSamples => {
      const result = { ...samples }
      if (this.minify || options.minify) {
        let minBy = 1
        const keyCount = Object.keys(result).length
        if (keyCount >= 17) minBy = 2
        if (keyCount >= 33) minBy = 4
        if (keyCount >= 49) minBy = 6

        const filtered = Object.keys(result).filter((_, i) => i % minBy !== 0)
        filtered.forEach((f) => delete result[f])
      }
      return result
    }

    // Check if this is a stereo instrument
    if (STEREO_INSTRUMENTS.includes(options.instruments)) {
      // Load both left and right channel samplers
      const rightSamples = minifySamples({ ...this[options.instruments] })
      const leftKey = `${options.instruments}-left` as keyof SampleLibraryType
      const leftSamples = minifySamples({ ...(this[leftKey] as NoteSamples) })

      const rightSampler = new Sampler(rightSamples, {
        baseUrl: options.baseUrl + options.instruments + "/",
        volume: options.volume,
      })
      const leftSampler = new Sampler(leftSamples, {
        baseUrl: options.baseUrl + options.instruments + "/",
        volume: options.volume,
      })

      return { left: leftSampler, right: rightSampler }
    }

    // If a single instrument name is passed (mono)
    const samples = minifySamples({ ...this[options.instruments] })
    const sampler = new Sampler(samples, {
      baseUrl: options.baseUrl + options.instruments + "/",
      volume: options.volume,
    })
    // Don't connect to destination here - let the caller handle routing
    return sampler
  },

  "guitar-12-string": {
    A0: "A0.wav",
    "A#0": "A%230.wav",
    B0: "B0.wav",
    C0: "C0.wav",
    "C#0": "C%230.wav",
    D0: "D0.wav",
    "D#0": "D%230.wav",
    E0: "E0.wav",
    F0: "F0.wav",
    "F#0": "F%230.wav",
    G0: "G0.wav",
    "G#0": "G%230.wav",
    A1: "A1.wav",
    "A#1": "A%231.wav",
    B1: "B1.wav",
    C1: "C1.wav",
    "C#1": "C%231.wav",
    D1: "D1.wav",
    "D#1": "D%231.wav",
    E1: "E1.wav",
    F1: "F1.wav",
    "F#1": "F%231.wav",
    G1: "G1.wav",
    "G#1": "G%231.wav",
    A2: "A2.wav",
    "A#2": "A%232.wav",
    B2: "B2.wav",
    C2: "C2.wav",
    "C#2": "C%232.wav",
    D2: "D2.wav",
    "D#2": "D%232.wav",
    E2: "E2.wav",
    F2: "F2.wav",
    "F#2": "F%232.wav",
    G2: "G2.wav",
    "G#2": "G%232.wav",
    A3: "A3.wav",
    "A#3": "A%233.wav",
    B3: "B3.wav",
    C3: "C3.wav",
    "C#3": "C%233.wav",
    D3: "D3.wav",
    "D#3": "D%233.wav",
    E3: "E3.wav",
    F3: "F3.wav",
    "F#3": "F%233.wav",
    G3: "G3.wav",
    "G#3": "G%233.wav",
    A4: "A4.wav",
    "A#4": "A%234.wav",
    B4: "B4.wav",
    C4: "C4.wav",
    "C#4": "C%234.wav",
    D4: "D4.wav",
    "D#4": "D%234.wav",
    E4: "E4.wav",
    F4: "F4.wav",
    "F#4": "F%234.wav",
    G4: "G4.wav",
    "G#4": "G%234.wav",
    A5: "A5.wav",
    "A#5": "A%235.wav",
    B5: "B5.wav",
    C5: "C5.wav",
    "C#5": "C%235.wav",
    D5: "D5.wav",
    "D#5": "D%235.wav",
    E5: "E5.wav",
    F5: "F5.wav",
    "F#5": "F%235.wav",
    G5: "G5.wav",
    "G#5": "G%235.wav",
    A6: "A6.wav",
    "A#6": "A%236.wav",
    B6: "B6.wav",
    C6: "C6.wav",
    "C#6": "C%236.wav",
    D6: "D6.wav",
    "D#6": "D%236.wav",
    E6: "E6.wav",
    F6: "F6.wav",
    "F#6": "F%236.wav",
    G6: "G6.wav",
    "G#6": "G%236.wav",
    C7: "C7.wav",
  },
  "guitar-acoustic": {
    E1: "E1R.wav",
    "F#1": "Gb1R.wav",
    "G#1": "Ab1R.wav",
    "A#1": "Bb1R.wav",
    C2: "C2R.wav",
    D2: "D2R.wav",
    E2: "E2R.wav",
    "F#2": "Gb2R.wav",
    "G#2": "Ab2R.wav",
    "A#2": "Bb2R.wav",
    C3: "C3R.wav",
    D3: "D3R.wav",
    E3: "E3R.wav",
    "F#3": "Gb3R.wav",
    "G#3": "Ab3R.wav",
    "A#3": "Bb3R.wav",
    C4: "C4R.wav",
    E4: "E4R.wav",
  },

  "guitar-acoustic-left": {
    E1: "E1L.wav",
    "F#1": "Gb1L.wav",
    "G#1": "Ab1L.wav",
    "A#1": "Bb1L.wav",
    C2: "C2L.wav",
    D2: "D2L.wav",
    E2: "E2L.wav",
    "F#2": "Gb2L.wav",
    "G#2": "Ab2L.wav",
    "A#2": "Bb2L.wav",
    C3: "C3L.wav",
    D3: "D3L.wav",
    E3: "E3L.wav",
    "F#3": "Gb3L.wav",
    "G#3": "Ab3L.wav",
    "A#3": "Bb3L.wav",
    C4: "C4L.wav",
    E4: "E4L.wav",
  },

  "guitar-classical": {
    A1: "A1r.wav",
    "A#2": "A%232r.wav",
    "A#3": "A%233r.wav",
    A2: "A2r.wav",
    A3: "A3r.wav",
    A4: "A4r.wav",
    B1: "B1r.wav",
    B2: "B2r.wav",
    B3: "B3r.wav",
    B4: "B4r.wav",
    C1: "C1r.wav",
    "C#1": "C%231r.wav",
    "C#2": "C%232r.wav",
    "C#3": "C%233r.wav",
    C2: "C2r.wav",
    C3: "C3r.wav",
    C4: "C4r.wav",
    C5: "C5r.wav",
    D1: "D1r.wav",
    "D#1": "D%231r.wav",
    "D#2": "D%232r.wav",
    "D#3": "D%233r.wav",
    D2: "D2r.wav",
    D3: "D3r.wav",
    D4: "D4r.wav",
    D5: "D5r.wav",
    E1: "E1r.wav",
    E2: "E2r.wav",
    E3: "E3r.wav",
    E4: "E4r.wav",
    F1: "F1r.wav",
    "F#2": "F%232r.wav",
    "F#3": "F%233r.wav",
    F2: "F2r.wav",
    F3: "F3r.wav",
    F4: "F4r.wav",
    G1: "G1r.wav",
    "G#2": "G%232r.wav",
    "G#3": "G%233r.wav",
    G2: "G2r.wav",
    G3: "G3r.wav",
    G4: "G4r.wav",
  },

  "guitar-classical-left": {
    A1: "A1l.wav",
    "A#2": "A%232l.wav",
    "A#3": "A%233l.wav",
    A2: "A2l.wav",
    A3: "A3l.wav",
    A4: "A4l.wav",
    B1: "B1l.wav",
    B2: "B2l.wav",
    B3: "B3l.wav",
    B4: "B4l.wav",
    C1: "C1l.wav",
    "C#1": "C%231l.wav",
    "C#2": "C%232l.wav",
    "C#3": "C%233l.wav",
    C2: "C2l.wav",
    C3: "C3l.wav",
    C4: "C4l.wav",
    C5: "C5l.wav",
    D1: "D1l.wav",
    "D#1": "D%231l.wav",
    "D#2": "D%232l.wav",
    "D#3": "D%233l.wav",
    D2: "D2l.wav",
    D3: "D3l.wav",
    D4: "D4l.wav",
    D5: "D5l.wav",
    E1: "E1l.wav",
    E2: "E2l.wav",
    E3: "E3l.wav",
    E4: "E4l.wav",
    F1: "F1l.wav",
    "F#2": "F%232l.wav",
    "F#3": "F%233l.wav",
    F2: "F2l.wav",
    F3: "F3l.wav",
    F4: "F4l.wav",
    G1: "G1l.wav",
    "G#2": "G%232l.wav",
    "G#3": "G%233l.wav",
    G2: "G2l.wav",
    G3: "G3l.wav",
    G4: "G4l.wav",
  },
}
