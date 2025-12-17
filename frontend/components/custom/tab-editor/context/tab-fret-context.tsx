"use client"
import { generateUUID } from "@/lib/utils"
import { createContext, useContext, useState } from "react"
import { useTabDataContext } from "./tab-data-context"

export type FretPositions = [number, number, number, number, number, number]

const TabFretContext = createContext<{
  fretPositions: FretPositions
  setFretPositions: React.Dispatch<React.SetStateAction<FretPositions>>
  addChordToLine: () => void
} | null>(null)

export function TabFretContextProvider({ children }: { children: React.ReactNode }) {
  const { chordLine, setChordLine } = useTabDataContext()
  const [fretPositions, setFretPositions] = useState<FretPositions>([0, 0, 0, 0, 0, 0])

  const addChordToLine = () => {
    const hasNotes = fretPositions.some((fret) => fret !== -1)
    if (hasNotes) {
      setChordLine((prev) => [
        ...prev,
        {
          id: generateUUID("chord"),
          positions: [...fretPositions] as FretPositions,
          pattern: [],
        },
      ])
    }
  }

  return (
    <TabFretContext.Provider value={{ fretPositions, setFretPositions, addChordToLine }}>
      {children}
    </TabFretContext.Provider>
  )
}

export function useTabFretContext() {
  const context = useContext(TabFretContext)
  if (!context) {
    throw new Error("useTabFretContext must be used within TabFretContextProvider")
  }
  return context
}
