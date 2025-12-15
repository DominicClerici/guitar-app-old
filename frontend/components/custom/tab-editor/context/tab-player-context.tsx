"use client"
import { midiToFrequency } from "@/lib/midi-utils"
import { isStereoSamplers } from "@/lib/SampleLibrary"
import { createContext, useContext } from "react"
import { toast } from "sonner"
import * as Tone from "tone"
import { useTabEffectsContext } from "./tab-effects-context"
import { FretPositions, useTabFretContext } from "./tab-fret-context"
import { useTabInstrumentContext } from "./tab-instrument-context"
import { useTabTuningContext } from "./tab-tuning-context"

const TabPlayerContext = createContext<{
  strumNotes: (strum?: "up" | "down", positions?: FretPositions, time?: number) => void
} | null>(null)

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

  const strumNotes = (
    strum: "up" | "down" = "down",
    positions: FretPositions = fretPositions,
    time?: number,
  ) => {
    if (!instrumentRef.current || !isInstrumentLoaded) {
      toast.error(
        `${!instrumentRef.current ? "Instrument ref null" : "Instrument ref not null, "} ${!isInstrumentLoaded ? "Instrument not loaded" : "Instrument loaded"}`,
      )
      return
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

      if (isStereoSamplers(instrument)) {
        // Stereo instrument - trigger both left and right samplers simultaneously
        frequencies.forEach((freq, i) => {
          const velocity = strum === "down" ? downVelocities[i] : upVelocities[i]
          const noteTime = start + i * strumDelay
          instrument.left.triggerAttackRelease(freq, "4", noteTime, velocity)
          instrument.right.triggerAttackRelease(freq, "4", noteTime, velocity)
        })
      } else {
        // Mono instrument
        frequencies.forEach((freq, i) => {
          const velocity = strum === "down" ? downVelocities[i] : upVelocities[i]
          instrument.triggerAttackRelease(freq, "4", start + i * strumDelay, velocity)
        })
      }
    }
  }

  return <TabPlayerContext.Provider value={{ strumNotes }}>{children}</TabPlayerContext.Provider>
}

export function useTabPlayerContext() {
  const context = useContext(TabPlayerContext)
  if (!context) {
    throw new Error("useTabPlayerContext must be used within TabPlayerContextProvider")
  }
  return context
}
