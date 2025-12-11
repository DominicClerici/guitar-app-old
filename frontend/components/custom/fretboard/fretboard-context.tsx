import {
  applyTuningToNoteCharacter,
  getNoteFromFret,
  getNoteFromMidi,
  midiToFrequency,
} from "@/lib/midi-utils"
import { InstrumentName, SampleLibrary } from "@/lib/SampleLibrary"
import React, { useContext, useState, useRef, useEffect } from "react"
import * as Tone from "tone"

export type FretPositions = [number, number, number, number, number, number]

export type Tuning = [number, number, number, number, number, number]

export type ChordLineItem = {
  id: string
  positions: FretPositions
}

export type EffectsSettings = {
  reverb: {
    enabled: boolean
    roomSize: number // Room size (0 to 1, where 1 is longest reverb)
    wet: number // Mix level (0 to 1)
  }
}

const DEFAULT_TUNING: Tuning = [0, 0, 0, 0, 0, 0] // EADGBE

const DEFAULT_EFFECTS: EffectsSettings = {
  reverb: {
    enabled: true,
    roomSize: 0.6,
    wet: 0.6,
  },
}

// Base MIDI notes for standard tuning (E2, A2, D3, G3, B3, E4)
// Note: String 0 is high E (E4), String 5 is low E (E2)
const STANDARD_TUNING_MIDI = [64, 59, 55, 50, 45, 40] // E4, B3, G3, D3, A2, E2

const FretboardContext = React.createContext<{
  fretPositions: FretPositions
  setFretPositions: React.Dispatch<React.SetStateAction<FretPositions>>
  tuning: Tuning
  setTuning: React.Dispatch<React.SetStateAction<Tuning>>
  strumNotes: (strum?: "up" | "down", positions?: FretPositions) => void
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
}>({
  fretPositions: [0, 0, 0, 0, 0, 0] as FretPositions,
  setFretPositions: () => {},
  tuning: DEFAULT_TUNING,
  setTuning: () => {},
  strumNotes: () => {},
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
})

export function FretboardContextProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [fretPositions, setFretPositions] = useState<FretPositions>([
    0, 0, 0, 0, 0, 0,
  ])
  const instrumentRef = useRef<Tone.Sampler | null>(null)
  const reverbRef = useRef<Tone.Freeverb | null>(null)
  const [tuning, setTuning] = useState<Tuning>(DEFAULT_TUNING)
  const [effects, setEffects] = useState<EffectsSettings>(DEFAULT_EFFECTS)
  const [instrument, setInstrument] =
    useState<InstrumentName>("guitar-acoustic")
  const [chordLine, setChordLine] = useState<ChordLineItem[]>([])
  const chordIdCounter = useRef(0)
  const [muteOnNewStrum, setMuteOnNewStrum] = useState(true)

  const addChordToLine = () => {
    const hasNotes = fretPositions.some((fret) => fret !== -1)
    if (hasNotes) {
      const id = `chord-${chordIdCounter.current++}`
      setChordLine((prev) => [
        ...prev,
        { id, positions: [...fretPositions] as FretPositions },
      ])
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
    if (instrumentRef.current) {
      instrumentRef.current.disconnect()
      instrumentRef.current.dispose()
    }
    if (reverbRef.current) {
      reverbRef.current.disconnect()
      reverbRef.current.dispose()
    }

    // Create reverb effect (Freeverb is algorithmic, no async generation needed)
    const reverb = new Tone.Freeverb({
      roomSize: effects.reverb.roomSize,
      wet: effects.reverb.enabled ? effects.reverb.wet : 0,
    })
    reverb.toDestination()
    reverbRef.current = reverb

    // Load instrument and connect to reverb
    const sampler = await SampleLibrary.load({
      instruments: newInstrument,
    })
    sampler.connect(reverb)
    instrumentRef.current = sampler

    await Tone.start()
  }

  const strumNotes = (
    strum: "up" | "down" = "down",
    positions: FretPositions = fretPositions
  ) => {
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

    const downVelocities = [1.0, 0.85, 0.7, 0.55, 0.4, 0.25]
    const upVelocities = [0.5, 0.6, 0.7, 0.8, 0.9, 1]

    const start = Tone.now()
    if (frequencies.length > 0) {
      const instrument = instrumentRef.current
      const strumDelay = 0.01

      frequencies.forEach((freq, i) => {
        const velocity = strum === "down" ? downVelocities[i] : upVelocities[i]
        instrument.triggerAttackRelease(
          freq,
          "4",
          start + i * strumDelay,
          velocity
        )
      })
    }
  }

  useEffect(() => {
    changeInstrument("guitar-acoustic")
  }, [])

  // Update reverb settings when effects change
  useEffect(() => {
    if (reverbRef.current) {
      reverbRef.current.wet.value = effects.reverb.enabled
        ? effects.reverb.wet
        : 0
    }
  }, [effects.reverb.enabled, effects.reverb.wet])

  // Update reverb room size (instant, no regeneration needed)
  useEffect(() => {
    if (reverbRef.current) {
      reverbRef.current.roomSize.value = effects.reverb.roomSize
    }
  }, [effects.reverb.roomSize])

  return (
    <FretboardContext.Provider
      value={{
        fretPositions,
        setFretPositions,
        tuning,
        setTuning,
        strumNotes,
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
      }}
    >
      {children}
    </FretboardContext.Provider>
  )
}

export default function useFretboardContext() {
  const context = useContext(FretboardContext)
  if (!context) {
    throw new Error(
      "useFretboardContext must be used within a FretboardContextProvider"
    )
  }
  return context
}
