import { Sampler } from "tone"

// format test
type NoteSamples = Record<string, string>

export type InstrumentName =
  | "guitar-acoustic"
  | "guitar-electric"
  | "guitar-nylon"
  | "guitar-acoustic-sf2"
interface LoadOptions {
  instruments?: InstrumentName
  baseUrl?: string
  onload?: (() => void) | null
  minify?: boolean
  volume?: number // Volume in dB (default 0)
}

interface SampleLibraryType {
  minify: boolean
  baseUrl: string
  list: InstrumentName[]
  onload: (() => void) | null
  load(arg?: LoadOptions): Promise<Sampler>
  "guitar-acoustic": NoteSamples
  "guitar-electric": NoteSamples
  "guitar-nylon": NoteSamples
  "guitar-acoustic-sf2": NoteSamples
}

export const SampleLibrary: SampleLibraryType = {
  minify: false,
  baseUrl: "/samples/",
  list: ["guitar-acoustic", "guitar-electric", "guitar-nylon", "guitar-acoustic-sf2"],
  onload: null,

  async load(arg?: LoadOptions) {
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

    // If a single instrument name is passed
    const samples = minifySamples({ ...this[options.instruments] })
    const sampler = new Sampler(samples, {
      baseUrl: options.baseUrl + options.instruments + "/",
      volume: options.volume,
    })
    // Don't connect to destination here - let the caller handle routing
    return sampler
  },

  "guitar-acoustic": {
    F4: "F4.ogg",
    "F#2": "Fs2.ogg",
    "F#3": "Fs3.ogg",
    "F#4": "Fs4.ogg",
    G2: "G2.ogg",
    G3: "G3.ogg",
    G4: "G4.ogg",
    "G#2": "Gs2.ogg",
    "G#3": "Gs3.ogg",
    "G#4": "Gs4.ogg",
    A2: "A2.ogg",
    A3: "A3.ogg",
    A4: "A4.ogg",
    "A#2": "As2.ogg",
    "A#3": "As3.ogg",
    "A#4": "As4.ogg",
    B2: "B2.ogg",
    B3: "B3.ogg",
    B4: "B4.ogg",
    C3: "C3.ogg",
    C4: "C4.ogg",
    C5: "C5.ogg",
    "C#3": "Cs3.ogg",
    "C#4": "Cs4.ogg",
    "C#5": "Cs5.ogg",
    D2: "D2.ogg",
    D3: "D3.ogg",
    D4: "D4.ogg",
    D5: "D5.ogg",
    "D#2": "Ds2.ogg",
    "D#3": "Ds3.ogg",
    "D#4": "Ds3.ogg",
    E2: "E2.ogg",
    E3: "E3.ogg",
    E4: "E4.ogg",
    F2: "F2.ogg",
    F3: "F3.ogg",
  },
  "guitar-acoustic-sf2": {
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
  "guitar-electric": {
    "D#3": "Ds3.ogg",
    "D#4": "Ds4.ogg",
    "D#5": "Ds5.ogg",
    E2: "E2.ogg",
    "F#2": "Fs2.ogg",
    "F#3": "Fs3.ogg",
    "F#4": "Fs4.ogg",
    "F#5": "Fs5.ogg",
    A2: "A2.ogg",
    A3: "A3.ogg",
    A4: "A4.ogg",
    A5: "A5.ogg",
    C3: "C3.ogg",
    C4: "C4.ogg",
    C5: "C5.ogg",
    C6: "C6.ogg",
    "C#2": "Cs2.ogg",
  },

  "guitar-nylon": {
    "F#2": "Fs2.ogg",
    "F#3": "Fs3.ogg",
    "F#4": "Fs4.ogg",
    "F#5": "Fs5.ogg",
    G3: "G3.ogg",
    G5: "G3.ogg",
    "G#2": "Gs2.ogg",
    "G#4": "Gs4.ogg",
    "G#5": "Gs5.ogg",
    A2: "A2.ogg",
    A3: "A3.ogg",
    A4: "A4.ogg",
    A5: "A5.ogg",
    "A#5": "As5.ogg",
    B1: "B1.ogg",
    B2: "B2.ogg",
    B3: "B3.ogg",
    B4: "B4.ogg",
    "C#3": "Cs3.ogg",
    "C#4": "Cs4.ogg",
    "C#5": "Cs5.ogg",
    D2: "D2.ogg",
    D3: "D3.ogg",
    D5: "D5.ogg",
    "D#4": "Ds4.ogg",
    E2: "E2.ogg",
    E3: "E3.ogg",
    E4: "E4.ogg",
    E5: "E5.ogg",
  },
}
