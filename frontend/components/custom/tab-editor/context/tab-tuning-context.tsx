"use client"

import { createContext, useContext, useState } from "react"

export type Tuning = [number, number, number, number, number, number]

const TabTuningContext = createContext<{
  tuning: Tuning
  setTuning: React.Dispatch<React.SetStateAction<Tuning>>
} | null>(null)

export function TabTuningContextProvider({ children }: { children: React.ReactNode }) {
  const [tuning, setTuning] = useState<Tuning>([0, 0, 0, 0, 0, 0])
  return (
    <TabTuningContext.Provider value={{ tuning, setTuning }}>{children}</TabTuningContext.Provider>
  )
}

export function useTabTuningContext() {
  const context = useContext(TabTuningContext)
  if (!context) {
    throw new Error("useTabTuningContext must be used within TabTuningContextProvider")
  }
  return context
}
