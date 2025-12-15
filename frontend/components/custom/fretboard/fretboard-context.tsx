"use client"
import { midiToFrequency } from "@/lib/midi-utils"
import { InstrumentName, SampleLibrary } from "@/lib/SampleLibrary"
import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import * as Tone from "tone"

export type FretPositions = [number, number, number, number, number, number]

export type Tuning = [number, number, number, number, number, number]

export type ChordLineItem = {
  id: string
  positions: FretPositions
}

// Available impulse response presets
export type ImpulseResponsePreset =
  | "small-room"
  | "medium-hall"
  | "large-hall"
  | "studio"
  | "church"
  | "plate"

export const IR_PRESETS: { id: ImpulseResponsePreset; name: string; url: string }[] = [
  { id: "small-room", name: "Small Room", url: "/impulses/small-room.wav" },
  { id: "medium-hall", name: "Medium Hall", url: "/impulses/medium-hall.wav" },
  { id: "large-hall", name: "Large Hall", url: "/impulses/large-hall.wav" },
  { id: "studio", name: "Studio", url: "/impulses/studio.wav" },
  { id: "church", name: "Church", url: "/impulses/church.wav" },
  { id: "plate", name: "Plate Reverb", url: "/impulses/plate.wav" },
]

export type EffectsSettings = {
  reverb: {
    enabled: boolean
    preset: ImpulseResponsePreset // Which impulse response to use
    wet: number // Mix level (0 to 1)
    preDelay: number // Pre-delay in seconds (0 to 0.1)
    decay: number // Decay multiplier (0.1 to 2) - affects how the IR is scaled
    highCut: number // High frequency cutoff for reverb (1000 to 20000 Hz)
  }
  sampler: {
    volume: number // Sampler volume in dB (-24 to 0)
  }
  limiter: {
    enabled: boolean
    threshold: number // Threshold in dB (-12 to 0)
  }
  compressor: {
    enabled: boolean
    threshold: number // Threshold in dB (-48 to 0)
    ratio: number // Compression ratio (1 to 20)
    attack: number // Attack time in seconds (0.001 to 0.1)
    release: number // Release time in seconds (0.01 to 1)
  }
  master: {
    gain: number // Master gain (0 to 1)
  }
  velocityScale: number // Scale factor for note velocities (0.1 to 1)
}

// Playback state types
export type PlaybackState = "stopped" | "playing" | "paused"

// Player interface - each component registers a player with these callbacks
export type PlayerCallbacks = {
  onPlay: (startTime: number) => void
  onStop: () => void
  onPause: () => void
  onResume: (resumeTime: number) => void
  onBpmChange: (newBpm: number) => void
}

export type RegisteredPlayer = {
  id: string
  callbacks: PlayerCallbacks
}

const DEFAULT_TUNING: Tuning = [0, 0, 0, 0, 0, 0] // EADGBE

const DEFAULT_EFFECTS: EffectsSettings = {
  reverb: {
    enabled: true,
    preset: "medium-hall",
    wet: 0.3,
    preDelay: 0.02,
    decay: 1.0,
    highCut: 8000,
  },
  sampler: {
    volume: -6,
  },
  limiter: {
    enabled: true,
    threshold: -1,
  },
  compressor: {
    enabled: true,
    threshold: -12,
    ratio: 4,
    attack: 0.003,
    release: 0.25,
  },
  master: {
    gain: 0.8,
  },
  velocityScale: 0.5,
}

// Base MIDI notes for standard tuning (E2, A2, D3, G3, B3, E4)
// Note: String 0 is high E (E4), String 5 is low E (E2)
const STANDARD_TUNING_MIDI = [64, 59, 55, 50, 45, 40] // E4, B3, G3, D3, A2, E2

const FretboardContext = React.createContext<{
  fretPositions: FretPositions
  setFretPositions: React.Dispatch<React.SetStateAction<FretPositions>>
  tuning: Tuning
  setTuning: React.Dispatch<React.SetStateAction<Tuning>>
  strumNotes: (strum?: "up" | "down", positions?: FretPositions, time?: number) => void
  playNote: (string: number, fret: number, time?: number, duration?: string | number) => void
  releaseString: (string: number, time?: number) => void
  releaseAllStrings: (time?: number) => void
  instrument: InstrumentName
  changeInstrument: (instrument: InstrumentName) => Promise<void>
  chordLine: ChordLineItem[]
  addChordToLine: () => void
  removeChordFromLine: (id: string) => void
  reorderChordLine: (oldIndex: number, newIndex: number) => void
  clearChordLine: () => void
  muteOnNewStrum: boolean
  setMuteOnNewStrum: React.Dispatch<React.SetStateAction<boolean>>
  effects: EffectsSettings
  setEffects: React.Dispatch<React.SetStateAction<EffectsSettings>>
  // Centralized playback state
  playbackState: PlaybackState
  bpm: number
  setBpm: (bpm: number) => void
  registerPlayer: (id: string, callbacks: PlayerCallbacks) => void
  unregisterPlayer: (id: string) => void
  startPlayback: () => Promise<void>
  stopPlayback: () => void
  pausePlayback: () => void
  resumePlayback: () => void
  getTransportTime: () => number
}>({
  fretPositions: [0, 0, 0, 0, 0, 0] as FretPositions,
  setFretPositions: () => {},
  tuning: DEFAULT_TUNING,
  setTuning: () => {},
  strumNotes: () => {},
  playNote: () => {},
  releaseString: () => {},
  releaseAllStrings: () => {},
  instrument: "guitar-acoustic",
  changeInstrument: async () => {},
  chordLine: [],
  addChordToLine: () => {},
  removeChordFromLine: () => {},
  reorderChordLine: () => {},
  clearChordLine: () => {},
  muteOnNewStrum: true,
  setMuteOnNewStrum: () => {},
  effects: DEFAULT_EFFECTS,
  setEffects: () => {},
  // Centralized playback defaults
  playbackState: "stopped",
  bpm: 120,
  setBpm: () => {},
  registerPlayer: () => {},
  unregisterPlayer: () => {},
  startPlayback: async () => {},
  stopPlayback: () => {},
  pausePlayback: () => {},
  resumePlayback: () => {},
  getTransportTime: () => 0,
})

export function FretboardContextProvider({ children }: { children: React.ReactNode }) {
  const [fretPositions, setFretPositions] = useState<FretPositions>([0, 0, 0, 0, 0, 0])
  const instrumentRef = useRef<Tone.Sampler | null>(null)
  const convolverRef = useRef<Tone.Convolver | null>(null)
  const reverbGainRef = useRef<Tone.Gain | null>(null) // Wet gain for convolver
  const dryGainRef = useRef<Tone.Gain | null>(null) // Dry signal path
  const preDelayRef = useRef<Tone.Delay | null>(null) // Pre-delay before reverb
  const reverbHighCutRef = useRef<Tone.Filter | null>(null) // High cut filter on reverb
  const limiterRef = useRef<Tone.Limiter | null>(null)
  const compressorRef = useRef<Tone.Compressor | null>(null)
  const masterGainRef = useRef<Tone.Gain | null>(null)
  const [tuning, setTuning] = useState<Tuning>(DEFAULT_TUNING)
  const [effects, setEffects] = useState<EffectsSettings>(DEFAULT_EFFECTS)
  const [instrument, setInstrument] = useState<InstrumentName>("guitar-acoustic")
  const [chordLine, setChordLine] = useState<ChordLineItem[]>([])
  const chordIdCounter = useRef(0)
  const [muteOnNewStrum, setMuteOnNewStrum] = useState(true)
  // Track which frequency is currently playing on each string (for per-string note management)
  const stringFrequenciesRef = useRef<(number | null)[]>([null, null, null, null, null, null])

  // Centralized playback state
  const [playbackState, setPlaybackState] = useState<PlaybackState>("stopped")
  const [bpm, setBpmState] = useState(120)
  const registeredPlayersRef = useRef<Map<string, PlayerCallbacks>>(new Map())
  const playbackStartTimeRef = useRef<number>(0)
  const pausedAtRef = useRef<number>(0)

  const addChordToLine = () => {
    const hasNotes = fretPositions.some((fret) => fret !== -1)
    if (hasNotes) {
      const id = `chord-${chordIdCounter.current++}`
      setChordLine((prev) => [...prev, { id, positions: [...fretPositions] as FretPositions }])
    }
  }

  const removeChordFromLine = (id: string) => {
    setChordLine((prev) => prev.filter((item) => item.id !== id))
  }

  const clearChordLine = () => {
    setChordLine([])
  }

  const reorderChordLine = (oldIndex: number, newIndex: number) => {
    setChordLine((prev) => {
      const newChordLine = [...prev]
      const [removed] = newChordLine.splice(oldIndex, 1)
      newChordLine.splice(newIndex, 0, removed)
      return newChordLine
    })
  }

  const changeInstrument = async (newInstrument: InstrumentName) => {
    setInstrument(newInstrument)

    // Dispose of existing nodes
    if (instrumentRef.current) {
      instrumentRef.current.disconnect()
      instrumentRef.current.dispose()
    }
    if (convolverRef.current) {
      convolverRef.current.disconnect()
      convolverRef.current.dispose()
    }
    if (reverbGainRef.current) {
      reverbGainRef.current.disconnect()
      reverbGainRef.current.dispose()
    }
    if (dryGainRef.current) {
      dryGainRef.current.disconnect()
      dryGainRef.current.dispose()
    }
    if (preDelayRef.current) {
      preDelayRef.current.disconnect()
      preDelayRef.current.dispose()
    }
    if (reverbHighCutRef.current) {
      reverbHighCutRef.current.disconnect()
      reverbHighCutRef.current.dispose()
    }
    if (compressorRef.current) {
      compressorRef.current.disconnect()
      compressorRef.current.dispose()
    }
    if (limiterRef.current) {
      limiterRef.current.disconnect()
      limiterRef.current.dispose()
    }
    if (masterGainRef.current) {
      masterGainRef.current.disconnect()
      masterGainRef.current.dispose()
    }

    // Build signal chain:
    // Sampler -> [Dry path] ---------> Mix point -> Compressor -> Limiter -> Master Gain -> Destination
    //         -> [Wet path: PreDelay -> Convolver -> HighCut -> ReverbGain] -^

    // Create master gain (final volume control before destination)
    const masterGain = new Tone.Gain(effects.master.gain)
    masterGain.toDestination()
    masterGainRef.current = masterGain

    // Create limiter (prevents clipping)
    const limiter = new Tone.Limiter(effects.limiter.threshold)
    limiter.connect(masterGain)
    limiterRef.current = limiter

    // Create compressor (dynamic range control)
    const compressor = new Tone.Compressor({
      threshold: effects.compressor.threshold,
      ratio: effects.compressor.ratio,
      attack: effects.compressor.attack,
      release: effects.compressor.release,
    })
    // Connect compressor to limiter if enabled, otherwise bypass to limiter
    if (effects.compressor.enabled) {
      compressor.connect(limiter)
    }
    compressorRef.current = compressor

    // The mix point is where dry and wet signals combine
    const mixPoint = effects.compressor.enabled ? compressor : limiter

    // Create dry signal path
    const dryGain = new Tone.Gain(effects.reverb.enabled ? 1 - effects.reverb.wet : 1)
    dryGain.connect(mixPoint)
    dryGainRef.current = dryGain

    // Create wet signal path with convolver reverb
    // 1. Pre-delay (adds clarity by separating direct sound from reverb)
    const preDelay = new Tone.Delay(effects.reverb.preDelay)
    preDelayRef.current = preDelay

    // 2. Convolver (impulse response reverb for realistic room sound)
    const irPreset = IR_PRESETS.find((p) => p.id === effects.reverb.preset) || IR_PRESETS[0]
    const convolver = new Tone.Convolver(irPreset.url)
    convolverRef.current = convolver

    // 3. High cut filter (removes harsh high frequencies from reverb tail)
    const highCut = new Tone.Filter({
      frequency: effects.reverb.highCut,
      type: "lowpass",
      rolloff: -12,
    })
    reverbHighCutRef.current = highCut

    // 4. Reverb wet gain (controls mix level)
    const reverbGain = new Tone.Gain(effects.reverb.enabled ? effects.reverb.wet : 0)
    reverbGain.connect(mixPoint)
    reverbGainRef.current = reverbGain

    // Connect wet signal chain: preDelay -> convolver -> highCut -> reverbGain
    preDelay.connect(convolver)
    convolver.connect(highCut)
    highCut.connect(reverbGain)

    // Load instrument and connect to both dry and wet paths
    const sampler = await SampleLibrary.load({
      instruments: newInstrument,
      volume: effects.sampler.volume,
    })
    sampler.connect(dryGain)
    sampler.connect(preDelay)
    instrumentRef.current = sampler

    await Tone.start()
  }

  const strumNotes = useCallback(
    (strum: "up" | "down" = "down", positions: FretPositions = fretPositions, time?: number) => {
      if (!instrumentRef.current) {
        console.error("Instrument not loaded")
        return
      }

      // Release all currently ringing notes before playing new ones (like a real guitar)
      if (muteOnNewStrum) {
        instrumentRef.current.releaseAll()
      }

      const frequencies: number[] = []

      for (let string = 0; string < 6; string++) {
        const fret = positions[string]
        if (fret === -1) continue
        const midiNote = STANDARD_TUNING_MIDI[string] + tuning[string] + fret

        frequencies.push(midiToFrequency(midiNote))
      }
      if (strum === "down") {
        frequencies.reverse()
      }

      const downVelocities = [1.0, 0.85, 0.7, 0.55, 0.4, 0.25].map((v) => v * effects.velocityScale)
      const upVelocities = [0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => v * effects.velocityScale)

      const start = time ?? Tone.now()
      if (frequencies.length > 0) {
        const instrument = instrumentRef.current
        const strumDelay = 0.02

        frequencies.forEach((freq, i) => {
          const velocity = strum === "down" ? downVelocities[i] : upVelocities[i]
          instrument.triggerAttackRelease(freq, "4", start + i * strumDelay, velocity)
        })
      }
    },
    [fretPositions, muteOnNewStrum, tuning, effects.velocityScale],
  )

  // Play a single note on a specific string, releasing any previous note on that string
  const playNote = (string: number, fret: number, time?: number, duration?: string | number) => {
    if (!instrumentRef.current) {
      console.error("Instrument not loaded")
      return
    }

    const playTime = time ?? Tone.now()
    const midiNote = STANDARD_TUNING_MIDI[string] + tuning[string] + fret
    const frequency = midiToFrequency(midiNote)

    // Release any currently playing note on this string
    const currentFreq = stringFrequenciesRef.current[string]
    if (currentFreq !== null) {
      instrumentRef.current.triggerRelease(currentFreq, playTime)
    }

    // Play the new note
    if (duration !== undefined) {
      // Play with a specific duration
      instrumentRef.current.triggerAttackRelease(frequency, duration, playTime)
      // Clear the tracked frequency after duration (note will auto-release)
      stringFrequenciesRef.current[string] = null
    } else {
      // Play until explicitly released
      instrumentRef.current.triggerAttack(frequency, playTime)
      stringFrequenciesRef.current[string] = frequency
    }
  }

  // Release a specific string
  const releaseString = (string: number, time?: number) => {
    if (!instrumentRef.current) return

    const releaseTime = time ?? Tone.now()
    const currentFreq = stringFrequenciesRef.current[string]
    if (currentFreq !== null) {
      instrumentRef.current.triggerRelease(currentFreq, releaseTime)
      stringFrequenciesRef.current[string] = null
    }
  }

  // Release all strings
  const releaseAllStrings = (time?: number) => {
    if (!instrumentRef.current) return

    const releaseTime = time ?? Tone.now()
    for (let i = 0; i < 6; i++) {
      const currentFreq = stringFrequenciesRef.current[i]
      if (currentFreq !== null) {
        instrumentRef.current.triggerRelease(currentFreq, releaseTime)
        stringFrequenciesRef.current[i] = null
      }
    }
  }

  // Centralized playback control functions
  const registerPlayer = useCallback((id: string, callbacks: PlayerCallbacks) => {
    registeredPlayersRef.current.set(id, callbacks)
  }, [])

  const unregisterPlayer = useCallback((id: string) => {
    registeredPlayersRef.current.delete(id)
  }, [])

  const setBpm = useCallback((newBpm: number) => {
    const clampedBpm = Math.max(20, Math.min(300, newBpm))
    setBpmState(clampedBpm)
    Tone.getTransport().bpm.value = clampedBpm
    // Notify all registered players of BPM change
    registeredPlayersRef.current.forEach((callbacks) => {
      callbacks.onBpmChange(clampedBpm)
    })
  }, [])

  const startPlayback = useCallback(async () => {
    if (playbackState === "playing") return

    await Tone.start()
    Tone.getTransport().bpm.value = bpm

    // Reset transport position for fresh start
    Tone.getTransport().position = 0

    // Start slightly in the future to avoid scheduling errors with Parts
    const startTime = Tone.now() + 0.1
    playbackStartTimeRef.current = startTime

    // Notify all registered players to set up their playback BEFORE starting transport
    // This ensures Tone.Part instances are created and started before the transport begins
    registeredPlayersRef.current.forEach((callbacks) => {
      callbacks.onPlay(startTime)
    })

    // Start the transport AFTER players have set up their Parts
    // Pass the startTime to align transport with scheduled events
    Tone.getTransport().start(startTime)

    setPlaybackState("playing")
  }, [playbackState, bpm])

  const stopPlayback = useCallback(() => {
    Tone.getTransport().stop()
    Tone.getTransport().position = 0

    setPlaybackState("stopped")
    playbackStartTimeRef.current = 0
    pausedAtRef.current = 0

    // Notify all registered players to stop
    registeredPlayersRef.current.forEach((callbacks) => {
      callbacks.onStop()
    })

    // Release all ringing notes
    releaseAllStrings()
  }, [])

  const pausePlayback = useCallback(() => {
    if (playbackState !== "playing") return

    pausedAtRef.current = Tone.getTransport().seconds
    Tone.getTransport().pause()

    setPlaybackState("paused")

    // Notify all registered players to pause
    registeredPlayersRef.current.forEach((callbacks) => {
      callbacks.onPause()
    })
  }, [playbackState])

  const resumePlayback = useCallback(() => {
    if (playbackState !== "paused") return

    const resumeTime = Tone.now()
    Tone.getTransport().start()

    setPlaybackState("playing")

    // Notify all registered players to resume
    registeredPlayersRef.current.forEach((callbacks) => {
      callbacks.onResume(resumeTime)
    })
  }, [playbackState])

  const getTransportTime = useCallback(() => {
    return Tone.getTransport().seconds
  }, [])

  useEffect(() => {
    changeInstrument("guitar-acoustic")
  }, [])

  // Update reverb wet/dry mix when effects change
  useEffect(() => {
    if (reverbGainRef.current && dryGainRef.current) {
      reverbGainRef.current.gain.value = effects.reverb.enabled ? effects.reverb.wet : 0
      dryGainRef.current.gain.value = effects.reverb.enabled ? 1 - effects.reverb.wet : 1
    }
  }, [effects.reverb.enabled, effects.reverb.wet])

  // Update reverb pre-delay
  useEffect(() => {
    if (preDelayRef.current) {
      preDelayRef.current.delayTime.value = effects.reverb.preDelay
    }
  }, [effects.reverb.preDelay])

  // Update reverb high cut filter
  useEffect(() => {
    if (reverbHighCutRef.current) {
      reverbHighCutRef.current.frequency.value = effects.reverb.highCut
    }
  }, [effects.reverb.highCut])

  // Update convolver preset (requires loading new impulse response)
  useEffect(() => {
    if (convolverRef.current) {
      const irPreset = IR_PRESETS.find((p) => p.id === effects.reverb.preset) || IR_PRESETS[0]
      convolverRef.current.load(irPreset.url)
    }
  }, [effects.reverb.preset])

  // Update sampler volume
  useEffect(() => {
    if (instrumentRef.current) {
      instrumentRef.current.volume.value = effects.sampler.volume
    }
  }, [effects.sampler.volume])

  // Update limiter threshold
  useEffect(() => {
    if (limiterRef.current) {
      limiterRef.current.threshold.value = effects.limiter.threshold
    }
  }, [effects.limiter.threshold])

  // Update compressor settings
  useEffect(() => {
    if (compressorRef.current) {
      compressorRef.current.threshold.value = effects.compressor.threshold
      compressorRef.current.ratio.value = effects.compressor.ratio
      compressorRef.current.attack.value = effects.compressor.attack
      compressorRef.current.release.value = effects.compressor.release
    }
  }, [effects.compressor.threshold, effects.compressor.ratio, effects.compressor.attack, effects.compressor.release])

  // Update master gain
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = effects.master.gain
    }
  }, [effects.master.gain])

  return (
    <FretboardContext.Provider
      value={{
        fretPositions,
        setFretPositions,
        tuning,
        setTuning,
        strumNotes,
        playNote,
        releaseString,
        releaseAllStrings,
        instrument,
        changeInstrument,
        chordLine,
        addChordToLine,
        removeChordFromLine,
        reorderChordLine,
        clearChordLine,
        muteOnNewStrum,
        setMuteOnNewStrum,
        effects,
        setEffects,
        // Centralized playback
        playbackState,
        bpm,
        setBpm,
        registerPlayer,
        unregisterPlayer,
        startPlayback,
        stopPlayback,
        pausePlayback,
        resumePlayback,
        getTransportTime,
      }}
    >
      {children}
    </FretboardContext.Provider>
  )
}

export default function useFretboardContext() {
  const context = useContext(FretboardContext)
  if (!context) {
    throw new Error("useFretboardContext must be used within a FretboardContextProvider")
  }
  return context
}
