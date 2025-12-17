"use client"
import { TabInformation } from "@/lib/fetches/getTab"
import { createContext, useContext, useState } from "react"
import { TabDataContextProvider, useTabDataContext } from "./context/tab-data-context"
import TabEffectsContextProvider, { useTabEffectsContext } from "./context/tab-effects-context"
import { TabFretContextProvider, useTabFretContext } from "./context/tab-fret-context"
import {
  TabInstrumentContextProvider,
  useTabInstrumentContext,
} from "./context/tab-instrument-context"
import { TabPlayerContextProvider, useTabPlayerContext } from "./context/tab-player-context"
import { TabSettingsContextProvider, useTabSettingsContext } from "./context/tab-settings-context"
import { TabTuningContextProvider, useTabTuningContext } from "./context/tab-tuning-context"

const TabContext = createContext<{
  isPlaying: boolean
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>
} | null>(null)

interface TabContextMainProps {
  children: React.ReactNode
  initialTabSettings: TabInformation
}

export function TabContextMain({ children, initialTabSettings }: TabContextMainProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  return (
    <TabContext.Provider value={{ isPlaying, setIsPlaying }}>
      <TabSettingsContextProvider initialTabSettings={initialTabSettings}>
        <TabEffectsContextProvider>
          <TabInstrumentContextProvider>
            <TabDataContextProvider>
              <TabTuningContextProvider>
                <TabFretContextProvider>
                  <TabPlayerContextProvider isPlaying={isPlaying} setIsPlaying={setIsPlaying}>
                    {children}
                  </TabPlayerContextProvider>
                </TabFretContextProvider>
              </TabTuningContextProvider>
            </TabDataContextProvider>
          </TabInstrumentContextProvider>
        </TabEffectsContextProvider>
      </TabSettingsContextProvider>
    </TabContext.Provider>
  )
}

export function useTabContext() {
  const tabDataContext = useTabDataContext()
  const tabSettingsContext = useTabSettingsContext()
  const tabFretContext = useTabFretContext()
  const tabTuningContext = useTabTuningContext()
  const tabEffectsContext = useTabEffectsContext()
  const tabPlayerContext = useTabPlayerContext()
  const tabInstrumentContext = useTabInstrumentContext()
  const context = useContext(TabContext)

  if (!context) {
    throw new Error("useTabContext must be used within TabContextMain")
  }
  return {
    ...context,
    ...tabDataContext,
    ...tabSettingsContext,
    ...tabFretContext,
    ...tabTuningContext,
    ...tabEffectsContext,
    ...tabPlayerContext,
    ...tabInstrumentContext,
  }
}

export default useTabContext
