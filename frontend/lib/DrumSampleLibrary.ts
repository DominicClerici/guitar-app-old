import * as Tone from "tone"

// Drum sound names that can be triggered
export type DrumSound = "kick" | "snare" | "hihat-closed" | "hihat-open"

export type DrumKitName = "drums-simple" // | "drums-power" - to be added later

// Stereo Players wrapper (left and right channels)
export type StereoDrumPlayers = {
  left: Tone.Players
  right: Tone.Players
}

export type DrumLoadResult = Tone.Players | StereoDrumPlayers

export function isStereoDrumPlayers(result: DrumLoadResult): result is StereoDrumPlayers {
  return (result as StereoDrumPlayers).left !== undefined
}

// Sample mappings for each drum kit
type DrumSampleMap = Record<DrumSound, string>

interface DrumKitConfig {
  samples: DrumSampleMap
  stereo: boolean
  // For stereo kits, the suffix to append for left channel (right is the base)
  leftSuffix?: string
}

const DRUM_KITS: Record<DrumKitName, DrumKitConfig> = {
  "drums-simple": {
    samples: {
      kick: "jf drums - kickL.wav",
      snare: "jf drums - snareL.wav",
      "hihat-closed": "jf drums - closed hatL.wav",
      "hihat-open": "jf drums - open hatL.wav",
    },
    stereo: false, // drums-simple only has mono samples (all end in L)
  },
  // drums-power will be added once we have the sample mapping
}

// List of available drum sounds for iteration
export const DRUM_SOUNDS: DrumSound[] = ["kick", "snare", "hihat-closed", "hihat-open"]

interface DrumLoadOptions {
  kit?: DrumKitName
  baseUrl?: string
  volume?: number
}

export const DrumSampleLibrary = {
  baseUrl: "/samples/",
  list: ["drums-simple"] as DrumKitName[],

  async load(options?: DrumLoadOptions): Promise<DrumLoadResult> {
    const kit = options?.kit ?? "drums-simple"
    const baseUrl = options?.baseUrl ?? this.baseUrl
    const volume = options?.volume ?? 0

    const kitConfig = DRUM_KITS[kit]
    const kitBaseUrl = `${baseUrl}${kit}/`

    // Build the URL map for Tone.Players
    const buildUrlMap = (samples: DrumSampleMap): Record<string, string> => {
      const urlMap: Record<string, string> = {}
      for (const [sound, filename] of Object.entries(samples)) {
        urlMap[sound] = kitBaseUrl + encodeURIComponent(filename)
      }
      return urlMap
    }

    if (kitConfig.stereo && kitConfig.leftSuffix) {
      // For stereo kits, create separate left and right Players
      // Build left channel URL map
      const leftUrlMap: Record<string, string> = {}
      const rightUrlMap: Record<string, string> = {}

      for (const [sound, filename] of Object.entries(kitConfig.samples)) {
        // Assuming right channel is the base filename
        rightUrlMap[sound] = kitBaseUrl + encodeURIComponent(filename)
        // Left channel has the suffix replaced
        const leftFilename = filename.replace(/R\.wav$/, `${kitConfig.leftSuffix}.wav`)
        leftUrlMap[sound] = kitBaseUrl + encodeURIComponent(leftFilename)
      }

      const leftPlayers = new Tone.Players(leftUrlMap, { volume })
      const rightPlayers = new Tone.Players(rightUrlMap, { volume })

      // Wait for both to load
      await Tone.loaded()

      return { left: leftPlayers, right: rightPlayers }
    }

    // Mono kit - single Players instance
    const urlMap = buildUrlMap(kitConfig.samples)
    const players = new Tone.Players(urlMap, { volume })

    await Tone.loaded()

    return players
  },

  // Helper to get available sounds for a kit
  getSounds(kit: DrumKitName): DrumSound[] {
    return Object.keys(DRUM_KITS[kit].samples) as DrumSound[]
  },

  // Check if a kit supports stereo
  isStereoKit(kit: DrumKitName): boolean {
    return DRUM_KITS[kit].stereo
  },
}
