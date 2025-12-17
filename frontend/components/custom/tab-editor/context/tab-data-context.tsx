"use client"
import { generateUUID } from "@/lib/utils"
import { arrayMove } from "@dnd-kit/sortable"
import { createContext, useCallback, useContext, useState } from "react"
import { FretPositions } from "./tab-fret-context"

export type TimeSignature = [number, number]

// a single chord strum
export type ChordStrum = {
  position: any // TODO: Think of a flexible way to define this. This is the time when the chord is strummed in its bar.
  direction: "up" | "down"
  velocity: number // leave unimplemented, just adding for data structure
  mute: boolean // leave unimplemented, just adding for data structure
}

// For now limited to 1 chord per bar of music
export type ChordLineItem = {
  id: string
  positions: FretPositions
  pattern: ChordStrum[]
}

export type ChordLine = {
  id: string
  name: string
  volume: number
  timeSignature: TimeSignature
  bpm: number
  chords: ChordLineItem[]
}

type TabDataContextType = {
  chordLine: ChordLineItem[]
  setChordLine: React.Dispatch<React.SetStateAction<ChordLineItem[]>>
  removeChordFromLine: (id: string) => void
  reorderChordLine: (oldIndex: number, newIndex: number) => void
  clearChordLine: () => void

  addChordEvent: (event: Omit<ChordLineItem, "id">) => void
  removeChordEvent: (eventId: string) => void
  updateChordEvent: (eventId: string, updates: Partial<ChordLineItem>) => void

  bpm: number
  setBpm: (bpm: number) => void
  timeSignature: [number, number]
  setTimeSignature: (timeSignature: [number, number]) => void
}

const TabDataContext = createContext<TabDataContextType | null>(null)

export function TabDataContextProvider({ children }: { children: React.ReactNode }) {
  const [chordLine, setChordLine] = useState<ChordLineItem[]>([])
  const [bpm, setBpm] = useState(120)
  const [timeSignature, setTimeSignature] = useState<[number, number]>([4, 4])

  const removeChordFromLine = useCallback((id: string) => {
    setChordLine((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const reorderChordLine = useCallback((oldIndex: number, newIndex: number) => {
    setChordLine((prev) => arrayMove(prev, oldIndex, newIndex))
  }, [])

  const clearChordLine = useCallback(() => {
    setChordLine([])
  }, [])

  const addChordEvent = useCallback((event: Omit<ChordLineItem, "id">) => {
    const newEvent: ChordLineItem = {
      ...event,
      id: generateUUID("chord"),
    }
    setChordLine((prev) => [...prev, newEvent])
  }, [])

  const removeChordEvent = useCallback((eventId: string) => {
    setChordLine((prev) => prev.filter((e) => e.id !== eventId))
  }, [])

  const updateChordEvent = useCallback((eventId: string, updates: Partial<ChordLineItem>) => {
    setChordLine((prev) => prev.map((e) => (e.id === eventId ? { ...e, ...updates } : e)))
  }, [])

  return (
    <TabDataContext.Provider
      value={{
        chordLine,
        setChordLine,
        removeChordFromLine,
        reorderChordLine,
        clearChordLine,

        addChordEvent,
        removeChordEvent,
        updateChordEvent,
        bpm,
        setBpm,
        timeSignature,
        setTimeSignature,
      }}
    >
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
