"use client"
import { DrumSound, isStereoDrumPlayers } from "@/lib/DrumSampleLibrary"
import { createContext, useCallback, useContext, useEffect, useRef } from "react"
import { toast } from "sonner"
import * as Tone from "tone"
import { useTabDataContext } from "./tab-data-context"
import { useTabInstrumentContext } from "./tab-instrument-context"

// Placeholder types - will be defined properly in tab-data-context later
export type DrumHit = {
  drum: DrumSound
  position: number // 0-1 normalized within the bar
  velocity: number
}

export type DrumPattern = DrumHit[]

type DrumPlayerContextType = {
  playDrum: (drum: DrumSound, time?: number, velocity?: number) => void
  startDrumPlayback: () => Promise<void>
  stopDrumPlayback: () => void
}

const DrumPlayerContext = createContext<DrumPlayerContextType | null>(null)

interface DrumPlayerContextProviderProps {
  children: React.ReactNode
  isPlaying: boolean
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>
}

export function DrumPlayerContextProvider({
  children,
  isPlaying,
  setIsPlaying,
}: DrumPlayerContextProviderProps) {
  const { drumInstrumentRef, isDrumInstrumentLoaded } = useTabInstrumentContext()
  const { bpm } = useTabDataContext()

  const partRef = useRef<Tone.Part | null>(null)

  // Play a single drum sound
  const playDrum = useCallback(
    (drum: DrumSound, time?: number, velocity: number = 1) => {
      if (!drumInstrumentRef.current || !isDrumInstrumentLoaded) {
        toast.error("Drum kit not loaded yet")
        return
      }

      const instrument = drumInstrumentRef.current
      const startTime = time ?? Tone.now()

      if (isStereoDrumPlayers(instrument)) {
        // Stereo - play on both channels
        const leftPlayer = instrument.left.player(drum)
        const rightPlayer = instrument.right.player(drum)
        if (leftPlayer && rightPlayer) {
          leftPlayer.start(startTime)
          rightPlayer.start(startTime)
        }
      } else {
        // Mono
        const player = instrument.player(drum)
        if (player) {
          player.start(startTime)
        }
      }
    },
    [drumInstrumentRef, isDrumInstrumentLoaded],
  )

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm
  }, [bpm])

  useEffect(() => {
    return () => {
      if (partRef.current) {
        partRef.current.dispose()
      }
    }
  }, [])

  // Skeleton for drum playback - to be implemented with drum pattern data
  const startDrumPlayback = useCallback(async () => {
    if (!isDrumInstrumentLoaded) {
      toast.error("Drum kit not loaded yet. Please wait.")
      return
    }

    await Tone.start()

    // TODO: Implement drum pattern playback
    // This will be similar to guitar playback:
    // 1. Get drum pattern from context (to be added to tab-data-context)
    // 2. Create events from pattern
    // 3. Create Tone.Part with events
    // 4. Start playback synchronized with transport

    // Placeholder: just log that we would start
    console.log("Drum playback started (skeleton)")

    // For now, just mark as playing if we want to test sync
    // setIsPlaying(true)
  }, [isDrumInstrumentLoaded])

  const stopDrumPlayback = useCallback(() => {
    if (partRef.current) {
      partRef.current.stop()
      partRef.current.dispose()
      partRef.current = null
    }

    console.log("Drum playback stopped (skeleton)")
    // setIsPlaying(false)
  }, [])

  return (
    <DrumPlayerContext.Provider
      value={{
        playDrum,
        startDrumPlayback,
        stopDrumPlayback,
      }}
    >
      {children}
    </DrumPlayerContext.Provider>
  )
}

export function useDrumPlayerContext() {
  const context = useContext(DrumPlayerContext)
  if (!context) {
    throw new Error("useDrumPlayerContext must be used within DrumPlayerContextProvider")
  }
  return context
}
