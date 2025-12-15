import { InstrumentName, SampleLibrary } from "@/lib/SampleLibrary"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import * as Tone from "tone"
import { useTabEffectsContext } from "./tab-effects-context"

const TabInstrumentContext = createContext<{
  instrument: InstrumentName
  setInstrument: React.Dispatch<React.SetStateAction<InstrumentName>>
  changeInstrument: (instrument: InstrumentName) => Promise<void>
  instrumentRef: React.RefObject<Tone.Sampler | null>
} | null>(null)

export function TabInstrumentContextProvider({ children }: { children: React.ReactNode }) {
  const { buildEffectsChain, resetEffects, effects } = useTabEffectsContext()
  const instrumentRef = useRef<Tone.Sampler | null>(null)
  const [instrument, setInstrument] = useState<InstrumentName>("guitar-acoustic")

  const changeInstrument = async (newInstrument: InstrumentName) => {
    setInstrument(newInstrument)
    const { dryGain, preDelay } = await buildEffectsChain(effects, undefined)
    const sampler = await SampleLibrary.load({
      instruments: newInstrument,
      volume: effects.sampler.volume,
    })
    instrumentRef.current = sampler
    sampler.connect(dryGain)
    sampler.connect(preDelay)
    await Tone.start()
  }

  useEffect(() => {
    changeInstrument("guitar-acoustic")
  }, [])

  return (
    <TabInstrumentContext.Provider
      value={{ instrument, setInstrument, changeInstrument, instrumentRef }}
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
