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
  const { chordLine, strumPattern, bpm } = useTabDataContext()

  const partRef = useRef<Tone.Part | null>(null)
  // Track the currently playing frequency on each string (index 0-5, null if not playing)
  const activeStringFrequencies = useRef<(number | null)[]>([null, null, null, null, null, null])

  const strumNotes = useCallback(
    (strum: "up" | "down" = "down", positions: FretPositions = fretPositions, time?: number) => {
      if (!instrumentRef.current || !isInstrumentLoaded) {
        toast.error(
          `${!instrumentRef.current ? "Instrument ref null" : "Instrument ref not null, "} ${!isInstrumentLoaded ? "Instrument not loaded" : "Instrument loaded"}`,
        )
        return
      }

      const instrument = instrumentRef.current
      const start = time ?? Tone.now()
      const strumDelay = 0.02

      const stringNotes: { stringIndex: number; frequency: number }[] = []

      for (let string = 0; string < 6; string++) {
        const fret = positions[string]
        if (fret === -1) continue
        const midiNote = STANDARD_TUNING_MIDI[string] + tuning[string] + fret
        const frequency = midiToFrequency(midiNote)
        stringNotes.push({ stringIndex: string, frequency })
      }

      // Reverse for down strum (low strings first in terms of pitch, which are higher indices)
      if (strum === "down") {
        stringNotes.reverse()
      }

      const downVelocities = DOWN_VELOCITIES.standard.map((v) => v * effects.velocityScale)
      const upVelocities = UP_VELOCITIES.standard.map((v) => v * effects.velocityScale)

      if (stringNotes.length > 0) {
        stringNotes.forEach((note, i) => {
          const velocity = strum === "down" ? downVelocities[i] : upVelocities[i]
          const noteTime = start + i * strumDelay

          // Release the old frequency on this string if one is playing
          const oldFreq = activeStringFrequencies.current[note.stringIndex]
          if (oldFreq !== null) {
            const releaseTime = Math.max(0, noteTime - 0.001)
            if (isStereoSamplers(instrument)) {
              instrument.left.triggerRelease(oldFreq, releaseTime)
              instrument.right.triggerRelease(oldFreq, releaseTime)
            } else {
              instrument.triggerRelease(oldFreq, releaseTime)
            }
          }

          // Trigger the new note
          if (isStereoSamplers(instrument)) {
            instrument.left.triggerAttack(note.frequency, noteTime, velocity)
            instrument.right.triggerAttack(note.frequency, noteTime, velocity)
          } else {
            instrument.triggerAttack(note.frequency, noteTime, velocity)
          }

          // Update tracking
          activeStringFrequencies.current[note.stringIndex] = note.frequency
        })
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

    if (strumPattern.length === 0) {
      toast.error("No strum pattern defined. Add strums to the pattern first.")
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

    const barDurationSeconds = (4 / bpm) * 60

    type PartEvent = { time: number; positions: FretPositions; strum: "up" | "down" }
    const events: PartEvent[] = []

    chordLine.forEach((chord: ChordLineItem, chordIndex: number) => {
      strumPattern.forEach((strum) => {
        const timeInSeconds = (chordIndex + strum.position) * barDurationSeconds
        events.push({
          time: timeInSeconds,
          positions: chord.positions,
          strum: strum.direction,
        })
      })
    })

    const totalDurationSeconds = chordLine.length * barDurationSeconds

    const part = new Tone.Part<PartEvent>((time, event) => {
      strumNotes(event.strum, event.positions, time)
    }, events)

    part.loop = true
    part.loopStart = 0
    part.loopEnd = totalDurationSeconds

    partRef.current = part

    Tone.getTransport().position = 0
    part.start(0)
    Tone.getTransport().start()

    setIsPlaying(true)
  }, [chordLine, strumPattern, bpm, isInstrumentLoaded, strumNotes, setIsPlaying])

  const stopPlayback = useCallback(() => {
    Tone.getTransport().stop()
    Tone.getTransport().position = 0

    if (partRef.current) {
      partRef.current.stop()
      partRef.current.dispose()
      partRef.current = null
    }

    // Clear active string tracking
    activeStringFrequencies.current = [null, null, null, null, null, null]

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
