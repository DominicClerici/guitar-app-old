"use client"
import { midiToFrequency } from "@/lib/midi-utils"
import { isStereoSamplers } from "@/lib/SampleLibrary"
import { createContext, useCallback, useContext, useEffect, useRef } from "react"
import { toast } from "sonner"
import * as Tone from "tone"
import {
  ChordEvent,
  ChordTrack,
  MelodyTrack,
  NoteEvent,
  useTabDataContext,
} from "./tab-data-context"
import { useTabEffectsContext } from "./tab-effects-context"
import { FretPositions, useTabFretContext } from "./tab-fret-context"
import { useTabInstrumentContext } from "./tab-instrument-context"
import { useTabTuningContext } from "./tab-tuning-context"

// ============================================
// Playback State Types
// ============================================
export type PlaybackState = "stopped" | "playing" | "paused"

// ============================================
// Player Callbacks for registering external components
// ============================================
export type PlayerCallbacks = {
  onPlay: (startTime: number) => void
  onStop: () => void
  onPause: () => void
  onResume: (resumeTime: number) => void
  onBpmChange: (newBpm: number) => void
}

// ============================================
// Context Type Definition
// ============================================
type TabPlayerContextType = {
  // Basic note/strum functions
  strumNotes: (strum?: "up" | "down", positions?: FretPositions, time?: number) => void
  playNote: (string: number, fret: number, time?: number, velocity?: number) => void
  releaseAllStrings: (time?: number) => void

  // Centralized playback control
  playbackState: PlaybackState
  startPlayback: () => Promise<void>
  stopPlayback: () => void
  pausePlayback: () => void
  resumePlayback: () => void
  getTransportPosition: () => string
  getTransportSeconds: () => number

  // Player registration (for external components like chord-line-editor)
  registerPlayer: (id: string, callbacks: PlayerCallbacks) => void
  unregisterPlayer: (id: string) => void

  // Current playback position tracking
  currentPosition: { bar: number; beat: number; sixteenth: number }
}

const TabPlayerContext = createContext<TabPlayerContextType | null>(null)

interface TabPlayerContextProviderProps {
  children: React.ReactNode
  isPlaying: boolean
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>
}

// Base MIDI notes for standard tuning (E2, A2, D3, G3, B3, E4)
// Note: String 0 is high E (E4), String 5 is low E (E2)
export const STANDARD_TUNING_MIDI = [64, 59, 55, 50, 45, 40] // E4, B3, G3, D3, A2, E2
export const STANDARD_TUNING_NOTES = ["E", "B", "G", "D", "A", "E"]

export function TabPlayerContextProvider({
  children,
  isPlaying,
  setIsPlaying,
}: TabPlayerContextProviderProps) {
  const { tuning } = useTabTuningContext()
  const { fretPositions } = useTabFretContext()
  const { effects } = useTabEffectsContext()
  const { instrumentRef, isInstrumentLoaded } = useTabInstrumentContext()
  const { tracks, bpm, timeSignature, chordLine, convertChordLineToEvents } = useTabDataContext()

  // ============================================
  // Refs for playback state management
  // ============================================
  const playbackStateRef = useRef<PlaybackState>("stopped")
  const registeredPlayersRef = useRef<Map<string, PlayerCallbacks>>(new Map())
  const partsRef = useRef<Tone.Part[]>([])
  const currentPositionRef = useRef({ bar: 0, beat: 0, sixteenth: 0 })

  // Track which frequency is playing on each string (for per-string note management)
  const stringFrequenciesRef = useRef<(number | null)[]>([null, null, null, null, null, null])

  // Refs to hold latest values for use in Tone.Part callbacks (avoids stale closures)
  const tuningRef = useRef(tuning)
  const effectsRef = useRef(effects)
  const instrumentRefRef = useRef(instrumentRef)

  // Keep refs updated
  useEffect(() => {
    tuningRef.current = tuning
  }, [tuning])

  useEffect(() => {
    effectsRef.current = effects
  }, [effects])

  useEffect(() => {
    instrumentRefRef.current = instrumentRef
  }, [instrumentRef])

  // ============================================
  // Sync BPM with Tone.Transport
  // ============================================
  useEffect(() => {
    Tone.getTransport().bpm.value = bpm
  }, [bpm])

  // ============================================
  // Basic Note Playing Functions
  // ============================================
  const strumNotes = useCallback(
    (strum: "up" | "down" = "down", positions: FretPositions = fretPositions, time?: number) => {
      const currentInstrumentRef = instrumentRefRef.current
      if (!currentInstrumentRef.current || !isInstrumentLoaded) {
        toast.error(
          `${!currentInstrumentRef.current ? "Instrument ref null" : "Instrument ref not null, "} ${!isInstrumentLoaded ? "Instrument not loaded" : "Instrument loaded"}`,
        )
        return
      }

      const currentTuning = tuningRef.current
      const currentEffects = effectsRef.current
      const frequencies: number[] = []

      for (let string = 0; string < 6; string++) {
        const fret = positions[string]
        if (fret === -1) continue
        const midiNote = STANDARD_TUNING_MIDI[string] + currentTuning[string] + fret
        frequencies.push(midiToFrequency(midiNote))
      }

      if (strum === "down") {
        frequencies.reverse()
      }

      const downVelocities = [1.0, 0.85, 0.7, 0.55, 0.4, 0.25].map(
        (v) => v * currentEffects.velocityScale,
      )
      const upVelocities = [0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => v * currentEffects.velocityScale)

      const start = time ?? Tone.now()
      if (frequencies.length > 0) {
        const instrument = currentInstrumentRef.current
        const strumDelay = 0.02

        if (isStereoSamplers(instrument)) {
          frequencies.forEach((freq, i) => {
            const velocity = strum === "down" ? downVelocities[i] : upVelocities[i]
            const noteTime = start + i * strumDelay
            instrument.left.triggerAttack(freq, noteTime, velocity)
            instrument.right.triggerAttack(freq, noteTime, velocity)
          })
        } else {
          frequencies.forEach((freq, i) => {
            const velocity = strum === "down" ? downVelocities[i] : upVelocities[i]
            instrument.triggerAttack(freq, start + i * strumDelay, velocity)
          })
        }
      }
    },
    [fretPositions, isInstrumentLoaded],
  )

  const playNote = useCallback(
    (string: number, fret: number, time?: number, velocity: number = 0.8) => {
      const currentInstrumentRef = instrumentRefRef.current
      if (!currentInstrumentRef.current || !isInstrumentLoaded) {
        return
      }

      const currentTuning = tuningRef.current
      const currentEffects = effectsRef.current
      const playTime = time ?? Tone.now()
      const midiNote = STANDARD_TUNING_MIDI[string] + currentTuning[string] + fret
      const frequency = midiToFrequency(midiNote)
      const instrument = currentInstrumentRef.current
      const adjustedVelocity = velocity * currentEffects.velocityScale

      // Release any currently playing note on this string
      const currentFreq = stringFrequenciesRef.current[string]
      if (currentFreq !== null) {
        if (isStereoSamplers(instrument)) {
          instrument.left.triggerRelease(currentFreq, playTime)
          instrument.right.triggerRelease(currentFreq, playTime)
        } else {
          instrument.triggerRelease(currentFreq, playTime)
        }
      }

      // Play the new note
      if (isStereoSamplers(instrument)) {
        instrument.left.triggerAttack(frequency, playTime, adjustedVelocity)
        instrument.right.triggerAttack(frequency, playTime, adjustedVelocity)
      } else {
        instrument.triggerAttack(frequency, playTime, adjustedVelocity)
      }

      stringFrequenciesRef.current[string] = frequency
    },
    [isInstrumentLoaded],
  )

  const releaseAllStrings = useCallback((time?: number) => {
    const currentInstrumentRef = instrumentRefRef.current
    if (!currentInstrumentRef.current) return

    const releaseTime = time ?? Tone.now()
    for (let i = 0; i < 6; i++) {
      const currentFreq = stringFrequenciesRef.current[i]
      if (currentFreq !== null) {
        if (isStereoSamplers(currentInstrumentRef.current)) {
          currentInstrumentRef.current.left.triggerRelease(currentFreq, releaseTime)
          currentInstrumentRef.current.right.triggerRelease(currentFreq, releaseTime)
        } else {
          currentInstrumentRef.current.triggerRelease(currentFreq, releaseTime)
        }
        stringFrequenciesRef.current[i] = null
      }
    }
  }, [])

  // ============================================
  // Player Registration
  // ============================================
  const registerPlayer = useCallback((id: string, callbacks: PlayerCallbacks) => {
    registeredPlayersRef.current.set(id, callbacks)
  }, [])

  const unregisterPlayer = useCallback((id: string) => {
    registeredPlayersRef.current.delete(id)
  }, [])

  // ============================================
  // Track Scheduling Functions
  // ============================================
  const scheduleMelodyTrack = useCallback(
    (track: MelodyTrack): Tone.Part | null => {
      if (track.muted || track.events.length === 0) return null

      const events = track.events.map((event) => ({
        time: event.time,
        event,
      }))

      const part = new Tone.Part<{ time: string | number; event: NoteEvent }>((time, value) => {
        const { event } = value
        playNote(event.string, event.fret, time, event.velocity || 0.8)
      }, events)

      part.start(0)
      return part
    },
    [playNote],
  )

  const scheduleChordTrack = useCallback(
    (track: ChordTrack): Tone.Part | null => {
      if (track.muted || track.events.length === 0) return null

      const events = track.events.map((event) => ({
        time: event.time,
        event,
      }))

      const part = new Tone.Part<{ time: string | number; event: ChordEvent }>((time, value) => {
        const { event } = value
        if (event.strum !== "none") {
          strumNotes(event.strum, event.positions, time)
        }

        // Update current position for UI
        Tone.getDraw().schedule(() => {
          const position = Tone.getTransport().position as string
          const [bars, beats, sixteenths] = position.split(":").map(Number)
          currentPositionRef.current = { bar: bars, beat: beats, sixteenth: Math.floor(sixteenths) }
        }, time)
      }, events)

      part.start(0)
      return part
    },
    [strumNotes],
  )

  // ============================================
  // Centralized Playback Control
  // ============================================
  const cleanupParts = useCallback(() => {
    partsRef.current.forEach((part) => {
      part.stop()
      part.dispose()
    })
    partsRef.current = []
  }, [])

  const startPlayback = useCallback(async () => {
    if (playbackStateRef.current === "playing") return

    await Tone.start()
    Tone.getTransport().bpm.value = bpm
    Tone.getTransport().timeSignature = timeSignature

    // Clean up any existing parts
    cleanupParts()

    // Reset transport position for fresh start
    Tone.getTransport().position = 0

    const startTime = Tone.now() + 0.1

    // Schedule all tracks
    tracks.forEach((track) => {
      let part: Tone.Part | null = null
      if (track.type === "melody") {
        part = scheduleMelodyTrack(track)
      } else if (track.type === "chord") {
        part = scheduleChordTrack(track)
      }
      if (part) {
        partsRef.current.push(part)
      }
    })

    // If there's a chord line but no chord tracks, create temporary events for it
    if (chordLine.length > 0 && !tracks.some((t) => t.type === "chord")) {
      const chordEvents = convertChordLineToEvents(chordLine)
      const tempTrack: ChordTrack = {
        id: "temp-chord-track",
        name: "Chord Line",
        type: "chord",
        events: chordEvents,
        volume: 1,
        muted: false,
      }
      const part = scheduleChordTrack(tempTrack)
      if (part) {
        // Each chord occupies 1 full bar, so total bars = number of chords
        const totalBars = chordLine.length
        part.loop = true
        part.loopEnd = `${totalBars}:0:0`
        partsRef.current.push(part)
      }
    }

    // Notify all registered external players
    registeredPlayersRef.current.forEach((callbacks) => {
      callbacks.onPlay(startTime)
    })

    // Start the transport
    Tone.getTransport().start(startTime)

    playbackStateRef.current = "playing"
    setIsPlaying(true)
  }, [
    bpm,
    timeSignature,
    tracks,
    chordLine,
    convertChordLineToEvents,
    scheduleMelodyTrack,
    scheduleChordTrack,
    cleanupParts,
    setIsPlaying,
  ])

  const stopPlayback = useCallback(() => {
    Tone.getTransport().stop()
    Tone.getTransport().position = 0

    cleanupParts()
    releaseAllStrings()

    // Notify all registered external players
    registeredPlayersRef.current.forEach((callbacks) => {
      callbacks.onStop()
    })

    playbackStateRef.current = "stopped"
    setIsPlaying(false)
    currentPositionRef.current = { bar: 0, beat: 0, sixteenth: 0 }
  }, [cleanupParts, releaseAllStrings, setIsPlaying])

  const pausePlayback = useCallback(() => {
    if (playbackStateRef.current !== "playing") return

    Tone.getTransport().pause()

    // Notify all registered external players
    registeredPlayersRef.current.forEach((callbacks) => {
      callbacks.onPause()
    })

    playbackStateRef.current = "paused"
    setIsPlaying(false)
  }, [setIsPlaying])

  const resumePlayback = useCallback(() => {
    if (playbackStateRef.current !== "paused") return

    const resumeTime = Tone.now()
    Tone.getTransport().start()

    // Notify all registered external players
    registeredPlayersRef.current.forEach((callbacks) => {
      callbacks.onResume(resumeTime)
    })

    playbackStateRef.current = "playing"
    setIsPlaying(true)
  }, [setIsPlaying])

  const getTransportPosition = useCallback(() => {
    return Tone.getTransport().position as string
  }, [])

  const getTransportSeconds = useCallback(() => {
    return Tone.getTransport().seconds
  }, [])

  // ============================================
  // Cleanup on unmount
  // ============================================
  useEffect(() => {
    return () => {
      cleanupParts()
      Tone.getTransport().stop()
      Tone.getTransport().cancel()
    }
  }, [cleanupParts])

  // ============================================
  // Notify players of BPM changes
  // ============================================
  useEffect(() => {
    registeredPlayersRef.current.forEach((callbacks) => {
      callbacks.onBpmChange(bpm)
    })
  }, [bpm])

  return (
    <TabPlayerContext.Provider
      value={{
        strumNotes,
        playNote,
        releaseAllStrings,
        playbackState: playbackStateRef.current,
        startPlayback,
        stopPlayback,
        pausePlayback,
        resumePlayback,
        getTransportPosition,
        getTransportSeconds,
        registerPlayer,
        unregisterPlayer,
        currentPosition: currentPositionRef.current,
      }}
    >
      {children}
    </TabPlayerContext.Provider>
  )
}

export function useTabPlayerContext() {
  const context = useContext(TabPlayerContext)
  if (!context) {
    throw new Error("useTabPlayerContext must be used within TabPlayerContextProvider")
  }
  return context
}
