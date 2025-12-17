"use client"
import { DOWN_VELOCITIES, STANDARD_TUNING_MIDI, UP_VELOCITIES } from "@/lib/constants"
import { midiToFrequency } from "@/lib/midi-utils"
import { isStereoSamplers } from "@/lib/SampleLibrary"
import { createContext, useCallback, useContext, useRef } from "react"
import { toast } from "sonner"
import * as Tone from "tone"
import { useTabEffectsContext } from "./tab-effects-context"
import { FretPositions, useTabFretContext } from "./tab-fret-context"
import { useTabInstrumentContext } from "./tab-instrument-context"
import { useTabTuningContext } from "./tab-tuning-context"

type TabPlayerContextType = {
  strumNotes: (strum?: "up" | "down", positions?: FretPositions, time?: number) => void
  currentPosition: { bar: number; beat: number; sixteenth: number }
}

const TabPlayerContext = createContext<TabPlayerContextType | null>(null)

interface TabPlayerContextProviderProps {
  children: React.ReactNode
  isPlaying: boolean
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>
}

export function TabPlayerContextProvider({
  children,
  isPlaying,
  setIsPlaying,
}: TabPlayerContextProviderProps) {
  const { tuning } = useTabTuningContext()
  const { fretPositions } = useTabFretContext()
  const { effects } = useTabEffectsContext()
  const { instrumentRef, isInstrumentLoaded } = useTabInstrumentContext()

  const currentPositionRef = useRef({ bar: 0, beat: 0, sixteenth: 0 })

  const strumNotes = useCallback(
    (strum: "up" | "down" = "down", positions: FretPositions = fretPositions, time?: number) => {
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

      const downVelocities = DOWN_VELOCITIES.standard.map((v) => v * effects.velocityScale)
      const upVelocities = UP_VELOCITIES.standard.map((v) => v * effects.velocityScale)

      const start = time ?? Tone.now()
      if (frequencies.length > 0) {
        const instrument = instrumentRef.current
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

  return (
    <TabPlayerContext.Provider
      value={{
        strumNotes,
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
