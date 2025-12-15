"use client"
import { createContext, useContext, useState } from "react"
import { FretPositions } from "./tab-fret-context"

export type ChordLineItem = {
  id: string
  positions: FretPositions
}

const TabDataContext = createContext<{
  chordLine: ChordLineItem[]
  setChordLine: React.Dispatch<React.SetStateAction<ChordLineItem[]>>
  tabData: any
  setTabData: React.Dispatch<React.SetStateAction<any>>
} | null>(null)

export function TabDataContextProvider({ children }: { children: React.ReactNode }) {
  const [tabData, setTabData] = useState<any>({})
  const [chordLine, setChordLine] = useState<ChordLineItem[]>([])

  return (
    <TabDataContext.Provider value={{ tabData, setTabData, chordLine, setChordLine }}>
      {children}
    </TabDataContext.Provider>
  )
}

export function useTabDataContext() {
  const context = useContext(TabDataContext)
  if (!context) {
    throw new Error("useTabDataContext must be used within TabDataContextProvider")
  }
  return context
}
