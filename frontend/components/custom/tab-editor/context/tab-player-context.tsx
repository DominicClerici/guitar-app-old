"use client"
import { DOWN_VELOCITIES, STANDARD_TUNING_MIDI, UP_VELOCITIES } from "@/lib/constants"
import { midiToFrequency } from "@/lib/midi-utils"
import { isStereoSamplers } from "@/lib/SampleLibrary"
import { createContext, useCallback, useContext, useEffect, useRef } from "react"
import { toast } from "sonner"
import * as Tone from "tone"
import { ChordLineItem, useTabDataContext } from "./tab-data-context"
import { useTabEffectsContext } from "./tab-effects-context"
import { FretPositions, useTabFretContext } from "./tab-fret-context"
import { useTabInstrumentContext } from "./tab-instrument-context"
import { useTabTuningContext } from "./tab-tuning-context"

type TabPlayerContextType = {
  strumNotes: (strum?: "up" | "down", positions?: FretPositions, time?: number) => void
  startPlayback: () => Promise<void>
  stopPlayback: () => void
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
  const { chordLine, bpm } = useTabDataContext()

  const partRef = useRef<Tone.Part | null>(null)

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
    [fretPositions, isInstrumentLoaded, tuning, effects.velocityScale, instrumentRef],
  )

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm
  }, [bpm])

  useEffect(() => {
    return () => {
      if (partRef.current) {
        partRef.current.dispose()
      }
      Tone.getTransport().stop()
      Tone.getTransport().cancel()
    }
  }, [])

  const startPlayback = useCallback(async () => {
    if (chordLine.length === 0) {
      toast.error("No chords to play. Add chords to the chord line first.")
      return
    }

    if (!isInstrumentLoaded) {
      toast.error("Instrument not loaded yet. Please wait.")
      return
    }

    await Tone.start()

    if (partRef.current) {
      partRef.current.dispose()
      partRef.current = null
    }

    // Build events from chord line
    // Each chord takes 4 beats (1 bar), with a downstrum on each beat
    type PartEvent = { time: string; positions: FretPositions; strum: "up" | "down" }
    const events: PartEvent[] = []

    chordLine.forEach((chord: ChordLineItem, chordIndex: number) => {
      for (let beat = 0; beat < 4; beat++) {
        events.push({
          time: `${chordIndex}:${beat}:0`,
          positions: chord.positions,
          strum: "down",
        })
      }
    })

    // Create the Part
    const part = new Tone.Part<PartEvent>((time, event) => {
      strumNotes(event.strum, event.positions, time)
    }, events)

    part.loop = true
    part.loopStart = 0
    part.loopEnd = `${chordLine.length}:0:0`

    partRef.current = part

    // Reset and start
    Tone.getTransport().position = 0
    part.start(0)
    Tone.getTransport().start()

    setIsPlaying(true)
  }, [chordLine, isInstrumentLoaded, strumNotes, setIsPlaying])

  const stopPlayback = useCallback(() => {
    Tone.getTransport().stop()
    Tone.getTransport().position = 0

    if (partRef.current) {
      partRef.current.stop()
      partRef.current.dispose()
      partRef.current = null
    }

    setIsPlaying(false)
  }, [setIsPlaying])

  return (
    <TabPlayerContext.Provider
      value={{
        strumNotes,
        startPlayback,
        stopPlayback,
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
