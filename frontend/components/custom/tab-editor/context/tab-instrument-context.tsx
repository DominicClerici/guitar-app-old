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

const TabInstrumentContext = createContext<{
  instrument: InstrumentName
  changeInstrument: (instrument: InstrumentName) => Promise<void>
  instrumentRef: React.RefObject<InstrumentRef>
  isInstrumentLoaded: boolean
} | null>(null)

export function TabInstrumentContextProvider({ children }: { children: React.ReactNode }) {
  const { buildEffectsChain, effects } = useTabEffectsContext()
  const instrumentRef = useRef<InstrumentRef>(null)
  const mergeRef = useRef<Tone.Merge | null>(null)
  const [instrument, setInstrument] = useState<InstrumentName>("guitar-acoustic")
  const [isInstrumentLoaded, setIsInstrumentLoaded] = useState(false)

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

  useEffect(() => {
    changeInstrument("guitar-acoustic")
  }, [])

  return (
    <TabInstrumentContext.Provider
      value={{ instrument, changeInstrument, instrumentRef, isInstrumentLoaded }}
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
