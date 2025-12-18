import {
  DrumKitName,
  DrumLoadResult,
  DrumSampleLibrary,
  isStereoDrumPlayers,
} from "@/lib/DrumSampleLibrary"
import {
  InstrumentName,
  isStereoSamplers,
  SampleLibrary,
  StereoSamplers,
} from "@/lib/SampleLibrary"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import * as Tone from "tone"
import { useTabEffectsContext } from "./tab-effects-context"

export type InstrumentRef = Tone.Sampler | StereoSamplers | null
export type DrumInstrumentRef = DrumLoadResult | null

const TabInstrumentContext = createContext<{
  // Guitar instrument
  instrument: InstrumentName
  changeInstrument: (instrument: InstrumentName) => Promise<void>
  instrumentRef: React.RefObject<InstrumentRef>
  isInstrumentLoaded: boolean
  // Drum instrument
  drumKit: DrumKitName
  changeDrumKit: (kit: DrumKitName) => Promise<void>
  drumInstrumentRef: React.RefObject<DrumInstrumentRef>
  isDrumInstrumentLoaded: boolean
} | null>(null)

export function TabInstrumentContextProvider({ children }: { children: React.ReactNode }) {
  const { buildEffectsChain, effects } = useTabEffectsContext()

  // Guitar instrument state
  const instrumentRef = useRef<InstrumentRef>(null)
  const mergeRef = useRef<Tone.Merge | null>(null)
  const [instrument, setInstrument] = useState<InstrumentName>("guitar-acoustic")
  const [isInstrumentLoaded, setIsInstrumentLoaded] = useState(false)

  // Drum instrument state
  const drumInstrumentRef = useRef<DrumInstrumentRef>(null)
  const drumMergeRef = useRef<Tone.Merge | null>(null)
  const [drumKit, setDrumKit] = useState<DrumKitName>("drums-simple")
  const [isDrumInstrumentLoaded, setIsDrumInstrumentLoaded] = useState(false)

  const changeInstrument = async (newInstrument: InstrumentName) => {
    setIsInstrumentLoaded(false)
    setInstrument(newInstrument)
    const { dryGain, preDelay } = await buildEffectsChain(effects, undefined)
    const loadResult = await SampleLibrary.load({
      instruments: newInstrument,
      volume: effects.sampler.volume,
    })

    // Clean up previous merge node if it exists
    if (mergeRef.current) {
      mergeRef.current.dispose()
      mergeRef.current = null
    }

    if (isStereoSamplers(loadResult)) {
      // Create a merge node for stereo routing
      const merge = new Tone.Merge()
      mergeRef.current = merge

      // Connect left sampler to left channel (input 0)
      loadResult.left.connect(merge, 0, 0)
      // Connect right sampler to right channel (input 1)
      loadResult.right.connect(merge, 0, 1)

      // Connect merge to effects chain
      merge.connect(dryGain)
      merge.connect(preDelay)

      instrumentRef.current = loadResult
    } else {
      // Mono instrument - connect directly
      instrumentRef.current = loadResult
      loadResult.connect(dryGain)
      loadResult.connect(preDelay)
    }

    setIsInstrumentLoaded(true)
  }

  const changeDrumKit = async (newKit: DrumKitName) => {
    setIsDrumInstrumentLoaded(false)
    setDrumKit(newKit)

    // For now, drums go directly to destination
    // TODO: Add separate drum effects chain if needed
    const loadResult = await DrumSampleLibrary.load({
      kit: newKit,
      volume: effects.sampler.volume,
    })

    // Clean up previous drum merge node if it exists
    if (drumMergeRef.current) {
      drumMergeRef.current.dispose()
      drumMergeRef.current = null
    }

    // Clean up previous drum instrument
    if (drumInstrumentRef.current) {
      if (isStereoDrumPlayers(drumInstrumentRef.current)) {
        drumInstrumentRef.current.left.dispose()
        drumInstrumentRef.current.right.dispose()
      } else {
        drumInstrumentRef.current.dispose()
      }
    }

    if (isStereoDrumPlayers(loadResult)) {
      // Create a merge node for stereo routing
      const merge = new Tone.Merge()
      drumMergeRef.current = merge

      // Connect left players to left channel (input 0)
      loadResult.left.connect(merge, 0, 0)
      // Connect right players to right channel (input 1)
      loadResult.right.connect(merge, 0, 1)

      // Connect merge to destination
      merge.toDestination()

      drumInstrumentRef.current = loadResult
    } else {
      // Mono drum kit - connect directly to destination
      drumInstrumentRef.current = loadResult
      loadResult.toDestination()
    }

    setIsDrumInstrumentLoaded(true)
  }

  useEffect(() => {
    changeInstrument("guitar-acoustic")
    changeDrumKit("drums-simple")
  }, [])

  return (
    <TabInstrumentContext.Provider
      value={{
        instrument,
        changeInstrument,
        instrumentRef,
        isInstrumentLoaded,
        drumKit,
        changeDrumKit,
        drumInstrumentRef,
        isDrumInstrumentLoaded,
      }}
    >
      {children}
    </TabInstrumentContext.Provider>
  )
}

export function useTabInstrumentContext() {
  const context = useContext(TabInstrumentContext)
  if (!context) {
    throw new Error("useTabInstrumentContext must be used within TabInstrumentContextProvider")
  }
  return context
}
