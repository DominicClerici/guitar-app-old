"use client"

import { getNoteName } from "@/lib/audio/guitar-notes"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import * as Tone from "tone"

// Maps string index to the note name currently playing on that string
type ActiveNotes = Map<number, string>

// Audio effects chain: Sampler → Reverb → Gain → Destination
interface AudioEffects {
  reverb: Tone.Freeverb
  masterGain: Tone.Gain
}

export interface EffectsSettings {
  masterVolume: number // 0-1
  reverbWet: number // 0-1
  reverbRoomSize: number // 0-1
  reverbDampening: number // frequency in Hz
}

export type GuitarInstrumentId = "guitar-12-string" | "guitar-acoustic" | "guitar-classical"

export type ChordNote = {
  stringIndex: number
  fret: number
}

export type LineChord = {
  id: string
  notes: ChordNote[]
}

interface InstrumentConfig {
  id: GuitarInstrumentId
  name: string
  baseUrl: string
  samples: Record<string, string>
}

const GUITAR_12_STRING_NOTES = [
  "Ab0",
  "Ab1",
  "Ab2",
  "Ab3",
  "Ab4",
  "Ab5",
  "Ab6",
  "A0",
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",
  "Bb0",
  "Bb1",
  "Bb2",
  "Bb3",
  "Bb4",
  "Bb5",
  "Bb6",
  "B0",
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
  "B6",
  "C0",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "Db0",
  "Db1",
  "Db2",
  "Db3",
  "Db4",
  "Db5",
  "Db6",
  "D0",
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "Eb0",
  "Eb1",
  "Eb2",
  "Eb3",
  "Eb4",
  "Eb5",
  "Eb6",
  "E0",
  "E1",
  "E2",
  "E3",
  "E4",
  "E5",
  "E6",
  "F0",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "Gb0",
  "Gb1",
  "Gb2",
  "Gb3",
  "Gb4",
  "Gb5",
  "Gb6",
  "G0",
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
]

const GUITAR_ACOUSTIC_NOTES = [
  "Ab1",
  "Ab2",
  "Ab3",
  "Bb1",
  "Bb2",
  "Bb3",
  "C2",
  "C3",
  "C4",
  "D2",
  "D3",
  "E1",
  "E2",
  "E3",
  "E4",
  "Gb1",
  "Gb2",
  "Gb3",
]

const GUITAR_CLASSICAL_NOTES = [
  "Ab2",
  "Ab3",
  "A1",
  "A2",
  "A3",
  "A4",
  "Bb2",
  "Bb3",
  "B1",
  "B2",
  "B3",
  "B4",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "Db1",
  "Db2",
  "Db3",
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "Eb1",
  "Eb2",
  "Eb3",
  "E1",
  "E2",
  "E3",
  "E4",
  "F1",
  "F2",
  "F3",
  "F4",
  "Gb2",
  "Gb3",
  "G1",
  "G2",
  "G3",
  "G4",
]

function createSampleMap(notes: string[], extension: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const note of notes) {
    map[note] = `${note}${extension}`
  }
  return map
}

function createStereoSampleMap(notes: string[], channel: "L" | "l"): Record<string, string> {
  const map: Record<string, string> = {}
  for (const note of notes) {
    map[note] = `${note}${channel}.wav`
  }
  return map
}

export const GUITAR_INSTRUMENTS: InstrumentConfig[] = [
  {
    id: "guitar-12-string",
    name: "12-String Guitar",
    baseUrl: "/samples/guitar-12-string/",
    samples: createSampleMap(GUITAR_12_STRING_NOTES, ".wav"),
  },
  {
    id: "guitar-acoustic",
    name: "Acoustic Guitar",
    baseUrl: "/samples/guitar-acoustic/",
    samples: createStereoSampleMap(GUITAR_ACOUSTIC_NOTES, "L"),
  },
  {
    id: "guitar-classical",
    name: "Classical Guitar",
    baseUrl: "/samples/guitar-classical/",
    samples: createStereoSampleMap(GUITAR_CLASSICAL_NOTES, "l"),
  },
]

type LoadingState = "idle" | "loading" | "loaded" | "error"

interface LoadedInstrument {
  sampler: Tone.Sampler
  state: LoadingState
}

interface TabsContextType {
  loadInstrument: (instrumentId: GuitarInstrumentId) => Promise<Tone.Sampler>
  getInstrument: (instrumentId: GuitarInstrumentId) => Tone.Sampler | undefined
  getLoadingState: (instrumentId: GuitarInstrumentId) => LoadingState
  playNote: (instrumentId: GuitarInstrumentId, note: string, duration?: string) => void
  strumChord: (
    instrumentId: GuitarInstrumentId,
    notes: ChordNote[],
    direction: "down" | "up",
    time?: number,
  ) => void
  instruments: typeof GUITAR_INSTRUMENTS
  lineChords: LineChord[]
  addChordToLine: (notes: ChordNote[]) => void
  removeChordFromLine: (chordId: string) => void
  reorderLineChords: (oldIndex: number, newIndex: number) => void
  clearLine: () => void
  bpm: number
  setBpm: (bpm: number) => void
  isPlaying: boolean
  startPlayback: (instrumentId: GuitarInstrumentId) => void
  stopPlayback: (instrumentId?: GuitarInstrumentId) => void
  effectsSettings: EffectsSettings
  setMasterVolume: (volume: number) => void
  setReverbWet: (wet: number) => void
  setReverbRoomSize: (roomSize: number) => void
  setReverbDampening: (dampening: number) => void
}

export const TabsContext = createContext<TabsContextType | undefined>(undefined)

const STRUM_DELAY_MS = 30

const DEFAULT_EFFECTS_SETTINGS: EffectsSettings = {
  masterVolume: 0.8,
  reverbWet: 0.3,
  reverbRoomSize: 0.7,
  reverbDampening: 3000,
}

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const loadedInstruments = useRef<Map<GuitarInstrumentId, LoadedInstrument>>(new Map())
  const [loadingStates, setLoadingStates] = useState<Record<GuitarInstrumentId, LoadingState>>({
    "guitar-12-string": "idle",
    "guitar-acoustic": "idle",
    "guitar-classical": "idle",
  })
  const [lineChords, setLineChords] = useState<LineChord[]>([])
  const [bpm, setBpm] = useState(60)
  const [isPlaying, setIsPlaying] = useState(false)
  const scheduledEventsRef = useRef<number[]>([])
  const activeNotesRef = useRef<ActiveNotes>(new Map())

  // Audio effects chain refs
  const reverbRef = useRef<Tone.Freeverb | null>(null)
  const masterGainRef = useRef<Tone.Gain | null>(null)
  const [effectsSettings, setEffectsSettings] = useState<EffectsSettings>(DEFAULT_EFFECTS_SETTINGS)

  // Initialize audio effects chain on mount
  useEffect(() => {
    const reverb = new Tone.Freeverb({
      roomSize: DEFAULT_EFFECTS_SETTINGS.reverbRoomSize,
      dampening: DEFAULT_EFFECTS_SETTINGS.reverbDampening,
      wet: DEFAULT_EFFECTS_SETTINGS.reverbWet,
    })

    const masterGain = new Tone.Gain(DEFAULT_EFFECTS_SETTINGS.masterVolume)

    reverb.connect(masterGain)
    masterGain.toDestination()

    reverbRef.current = reverb
    masterGainRef.current = masterGain

    return () => {
      reverb.dispose()
      masterGain.dispose()
    }
  }, [])

  // Effects control functions
  const setMasterVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume))
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = clampedVolume
    }
    setEffectsSettings((prev) => ({ ...prev, masterVolume: clampedVolume }))
  }, [])

  const setReverbWet = useCallback((wet: number) => {
    const clampedWet = Math.max(0, Math.min(1, wet))
    if (reverbRef.current) {
      reverbRef.current.wet.value = clampedWet
    }
    setEffectsSettings((prev) => ({ ...prev, reverbWet: clampedWet }))
  }, [])

  const setReverbRoomSize = useCallback((roomSize: number) => {
    const clampedRoomSize = Math.max(0, Math.min(1, roomSize))
    if (reverbRef.current) {
      reverbRef.current.roomSize.value = clampedRoomSize
    }
    setEffectsSettings((prev) => ({ ...prev, reverbRoomSize: clampedRoomSize }))
  }, [])

  const setReverbDampening = useCallback((dampening: number) => {
    const clampedDampening = Math.max(200, Math.min(10000, dampening))
    if (reverbRef.current) {
      reverbRef.current.dampening = clampedDampening
    }
    setEffectsSettings((prev) => ({ ...prev, reverbDampening: clampedDampening }))
  }, [])

  const loadInstrument = useCallback(
    async (instrumentId: GuitarInstrumentId): Promise<Tone.Sampler> => {
      const existing = loadedInstruments.current.get(instrumentId)
      if (existing?.state === "loaded") {
        return existing.sampler
      }

      const config = GUITAR_INSTRUMENTS.find((i) => i.id === instrumentId)
      if (!config) {
        throw new Error(`Unknown instrument: ${instrumentId}`)
      }

      setLoadingStates((prev) => ({ ...prev, [instrumentId]: "loading" }))

      try {
        const sampler = new Tone.Sampler({
          urls: config.samples,
          baseUrl: config.baseUrl,
          onload: () => {
            loadedInstruments.current.set(instrumentId, { sampler, state: "loaded" })
            setLoadingStates((prev) => ({ ...prev, [instrumentId]: "loaded" }))
          },
          onerror: (error) => {
            console.error(`Error loading instrument ${instrumentId}:`, error)
            setLoadingStates((prev) => ({ ...prev, [instrumentId]: "error" }))
          },
        })

        // Connect to effects chain instead of directly to destination
        if (reverbRef.current) {
          sampler.connect(reverbRef.current)
        } else {
          sampler.toDestination()
        }

        await Tone.loaded()

        return sampler
      } catch (error) {
        setLoadingStates((prev) => ({ ...prev, [instrumentId]: "error" }))
        throw error
      }
    },
    [],
  )

  const getInstrument = useCallback(
    (instrumentId: GuitarInstrumentId): Tone.Sampler | undefined => {
      return loadedInstruments.current.get(instrumentId)?.sampler
    },
    [],
  )

  const getLoadingState = useCallback(
    (instrumentId: GuitarInstrumentId): LoadingState => {
      return loadingStates[instrumentId]
    },
    [loadingStates],
  )

  const playNote = useCallback(
    (instrumentId: GuitarInstrumentId, note: string, duration: string = "4n") => {
      const instrument = loadedInstruments.current.get(instrumentId)
      if (instrument?.state === "loaded") {
        instrument.sampler.triggerAttackRelease(note, duration)
      }
    },
    [],
  )

  const strumChord = useCallback(
    (
      instrumentId: GuitarInstrumentId,
      notes: ChordNote[],
      direction: "down" | "up",
      time?: number,
    ) => {
      const instrument = loadedInstruments.current.get(instrumentId)
      if (!instrument || instrument.state !== "loaded" || notes.length === 0) return

      const baseTime = time ?? Tone.now()

      // Release all currently playing notes before strumming new ones
      const activeNotes = Array.from(activeNotesRef.current.values())
      if (activeNotes.length > 0) {
        instrument.sampler.triggerRelease(activeNotes, baseTime)
      }
      activeNotesRef.current.clear()

      const sortedNotes = [...notes].sort((a, b) => {
        if (direction === "down") {
          return b.stringIndex - a.stringIndex
        }
        return a.stringIndex - b.stringIndex
      })

      sortedNotes.forEach((note, index) => {
        const noteName = getNoteName(note.stringIndex, note.fret)
        const noteTime = baseTime + (index * STRUM_DELAY_MS) / 1000
        instrument.sampler.triggerAttack(noteName, noteTime)
        // Track this note as active on its string
        activeNotesRef.current.set(note.stringIndex, noteName)
      })
    },
    [],
  )

  const addChordToLine = useCallback((notes: ChordNote[]) => {
    if (notes.length === 0) return
    const newChord: LineChord = {
      id: crypto.randomUUID(),
      notes: [...notes],
    }
    setLineChords((prev) => [...prev, newChord])
  }, [])

  const removeChordFromLine = useCallback((chordId: string) => {
    setLineChords((prev) => prev.filter((c) => c.id !== chordId))
  }, [])

  const reorderLineChords = useCallback((oldIndex: number, newIndex: number) => {
    setLineChords((prev) => {
      const result = [...prev]
      const [removed] = result.splice(oldIndex, 1)
      result.splice(newIndex, 0, removed)
      return result
    })
  }, [])

  const clearLine = useCallback(() => {
    setLineChords([])
  }, [])

  const releaseAllNotes = useCallback((instrumentId: GuitarInstrumentId) => {
    const instrument = loadedInstruments.current.get(instrumentId)
    if (instrument?.state === "loaded") {
      const activeNotes = Array.from(activeNotesRef.current.values())
      if (activeNotes.length > 0) {
        instrument.sampler.triggerRelease(activeNotes)
      }
    }
    activeNotesRef.current.clear()
  }, [])

  const stopPlayback = useCallback(
    (instrumentId?: GuitarInstrumentId) => {
      Tone.getTransport().stop()
      Tone.getTransport().cancel()
      Tone.getTransport().position = 0
      scheduledEventsRef.current = []

      if (instrumentId) {
        releaseAllNotes(instrumentId)
      }

      setIsPlaying(false)
    },
    [releaseAllNotes],
  )

  const startPlayback = useCallback(
    (instrumentId: GuitarInstrumentId) => {
      if (lineChords.length === 0) return

      const instrument = loadedInstruments.current.get(instrumentId)
      if (!instrument || instrument.state !== "loaded") return

      stopPlayback(instrumentId)

      const transport = Tone.getTransport()
      transport.bpm.value = bpm
      transport.position = 0

      const beatsPerChord = 4

      // Schedule each strum as a one-shot event at the correct beat position
      lineChords.forEach((chord, chordIndex) => {
        for (let beat = 0; beat < beatsPerChord; beat++) {
          const beatPosition = chordIndex * beatsPerChord + beat
          // Use bars:beats:sixteenths format for precise timing
          const timePosition = `0:${beatPosition}:0`

          const eventId = transport.schedule((time) => {
            strumChord(instrumentId, chord.notes, "down", time)
          }, timePosition)

          scheduledEventsRef.current.push(eventId)
        }
      })

      // Schedule loop back to start for continuous playback
      const totalBeats = lineChords.length * beatsPerChord
      transport.loop = true
      transport.loopStart = 0
      transport.loopEnd = `0:${totalBeats}:0`

      transport.start()
      setIsPlaying(true)
    },
    [lineChords, bpm, strumChord, stopPlayback],
  )

  return (
    <TabsContext.Provider
      value={{
        loadInstrument,
        getInstrument,
        getLoadingState,
        playNote,
        strumChord,
        instruments: GUITAR_INSTRUMENTS,
        lineChords,
        addChordToLine,
        removeChordFromLine,
        reorderLineChords,
        clearLine,
        bpm,
        setBpm,
        isPlaying,
        startPlayback,
        stopPlayback,
        effectsSettings,
        setMasterVolume,
        setReverbWet,
        setReverbRoomSize,
        setReverbDampening,
      }}
    >
      {children}
    </TabsContext.Provider>
  )
}

export default function useTabs() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error("useTabs must be used within a TabsProvider")
  }
  return context
}
