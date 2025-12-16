"use client"
import { arrayMove } from "@dnd-kit/sortable"
import { createContext, useCallback, useContext, useState } from "react"
import { FretPositions } from "./tab-fret-context"

// ============================================
// Core Event Types for Playback
// ============================================

// A single note event (for melody lines)
export type NoteEvent = {
  id: string
  time: string | number // Tone.js time: "0:0:0", "4n", 0.5, etc.
  string: number // 0-5 guitar string
  fret: number // 0-24
  duration?: string | number // "8n", "4n", 0.25, etc. (defaults to "8n")
  velocity?: number // 0-1 (defaults to 0.8)
}

// A chord strum event (for chord lines)
export type ChordEvent = {
  id: string
  time: string | number // When to play
  positions: FretPositions // [-1, 3, 2, 0, 1, 0] style
  strum: "up" | "down" | "none"
  duration?: string | number
  velocity?: number
}

// ============================================
// Track Types
// ============================================

export type MelodyTrack = {
  id: string
  name: string
  type: "melody"
  events: NoteEvent[]
  volume: number // 0-1
  muted: boolean
}

export type ChordTrack = {
  id: string
  name: string
  type: "chord"
  events: ChordEvent[]
  volume: number // 0-1
  muted: boolean
}

export type Track = MelodyTrack | ChordTrack

// ============================================
// Legacy ChordLineItem (for visual chord builder)
// ============================================
export type ChordLineItem = {
  id: string
  positions: FretPositions
}

// ============================================
// Helper function to generate unique IDs
// ============================================
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// ============================================
// Context Type Definition
// ============================================
type TabDataContextType = {
  // Legacy chord line (visual builder)
  chordLine: ChordLineItem[]
  setChordLine: React.Dispatch<React.SetStateAction<ChordLineItem[]>>
  removeChordFromLine: (id: string) => void
  reorderChordLine: (oldIndex: number, newIndex: number) => void
  clearChordLine: () => void

  // Tracks for playback
  tracks: Track[]
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>
  addTrack: (type: "melody" | "chord", name?: string) => string
  removeTrack: (trackId: string) => void
  updateTrack: (trackId: string, updates: Partial<Omit<Track, "type">>) => void

  // Melody track event management
  addNoteEvent: (trackId: string, event: Omit<NoteEvent, "id">) => void
  removeNoteEvent: (trackId: string, eventId: string) => void
  updateNoteEvent: (trackId: string, eventId: string, updates: Partial<NoteEvent>) => void

  // Chord track event management
  addChordEvent: (trackId: string, event: Omit<ChordEvent, "id">) => void
  removeChordEvent: (trackId: string, eventId: string) => void
  updateChordEvent: (trackId: string, eventId: string, updates: Partial<ChordEvent>) => void

  // Convert chord line to chord track events (default: quarter note strums)
  convertChordLineToEvents: (chordLine: ChordLineItem[]) => ChordEvent[]

  // BPM and time signature
  bpm: number
  setBpm: (bpm: number) => void
  timeSignature: [number, number]
  setTimeSignature: (timeSignature: [number, number]) => void

  // Legacy tabData
  tabData: any
  setTabData: React.Dispatch<React.SetStateAction<any>>
}

const TabDataContext = createContext<TabDataContextType | null>(null)

export function TabDataContextProvider({ children }: { children: React.ReactNode }) {
  const [tabData, setTabData] = useState<any>({})
  const [chordLine, setChordLine] = useState<ChordLineItem[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [bpm, setBpmState] = useState(120)
  const [timeSignature, setTimeSignature] = useState<[number, number]>([4, 4])

  // ============================================
  // Legacy Chord Line Functions
  // ============================================
  const removeChordFromLine = useCallback((id: string) => {
    setChordLine((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const reorderChordLine = useCallback((oldIndex: number, newIndex: number) => {
    setChordLine((prev) => arrayMove(prev, oldIndex, newIndex))
  }, [])

  const clearChordLine = useCallback(() => {
    setChordLine([])
  }, [])

  // ============================================
  // Track Management
  // ============================================
  const addTrack = useCallback((type: "melody" | "chord", name?: string): string => {
    const id = generateId("track")
    const trackName = name || `${type === "melody" ? "Melody" : "Chord"} Track`

    if (type === "melody") {
      const newTrack: MelodyTrack = {
        id,
        name: trackName,
        type: "melody",
        events: [],
        volume: 1,
        muted: false,
      }
      setTracks((prev) => [...prev, newTrack])
    } else {
      const newTrack: ChordTrack = {
        id,
        name: trackName,
        type: "chord",
        events: [],
        volume: 1,
        muted: false,
      }
      setTracks((prev) => [...prev, newTrack])
    }

    return id
  }, [])

  const removeTrack = useCallback((trackId: string) => {
    setTracks((prev) => prev.filter((track) => track.id !== trackId))
  }, [])

  const updateTrack = useCallback((trackId: string, updates: Partial<Omit<Track, "type">>) => {
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track
        // Preserve the discriminated union by handling each type explicitly
        if (track.type === "melody") {
          return { ...track, ...updates } as MelodyTrack
        } else {
          return { ...track, ...updates } as ChordTrack
        }
      })
    )
  }, [])

  // ============================================
  // Note Event Management (for Melody Tracks)
  // ============================================
  const addNoteEvent = useCallback((trackId: string, event: Omit<NoteEvent, "id">) => {
    const newEvent: NoteEvent = {
      ...event,
      id: generateId("note"),
    }
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id === trackId && track.type === "melody") {
          return { ...track, events: [...track.events, newEvent] }
        }
        return track
      })
    )
  }, [])

  const removeNoteEvent = useCallback((trackId: string, eventId: string) => {
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id === trackId && track.type === "melody") {
          return { ...track, events: track.events.filter((e) => e.id !== eventId) }
        }
        return track
      })
    )
  }, [])

  const updateNoteEvent = useCallback(
    (trackId: string, eventId: string, updates: Partial<NoteEvent>) => {
      setTracks((prev) =>
        prev.map((track) => {
          if (track.id === trackId && track.type === "melody") {
            return {
              ...track,
              events: track.events.map((e) => (e.id === eventId ? { ...e, ...updates } : e)),
            }
          }
          return track
        })
      )
    },
    []
  )

  // ============================================
  // Chord Event Management (for Chord Tracks)
  // ============================================
  const addChordEvent = useCallback((trackId: string, event: Omit<ChordEvent, "id">) => {
    const newEvent: ChordEvent = {
      ...event,
      id: generateId("chord"),
    }
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id === trackId && track.type === "chord") {
          return { ...track, events: [...track.events, newEvent] }
        }
        return track
      })
    )
  }, [])

  const removeChordEvent = useCallback((trackId: string, eventId: string) => {
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id === trackId && track.type === "chord") {
          return { ...track, events: track.events.filter((e) => e.id !== eventId) }
        }
        return track
      })
    )
  }, [])

  const updateChordEvent = useCallback(
    (trackId: string, eventId: string, updates: Partial<ChordEvent>) => {
      setTracks((prev) =>
        prev.map((track) => {
          if (track.id === trackId && track.type === "chord") {
            return {
              ...track,
              events: track.events.map((e) => (e.id === eventId ? { ...e, ...updates } : e)),
            }
          }
          return track
        })
      )
    },
    []
  )

  // ============================================
  // Convert Chord Line to Playable Events
  // ============================================
  const convertChordLineToEvents = useCallback(
    (chordLineItems: ChordLineItem[]): ChordEvent[] => {
      // Each chord plays for 1 full bar with 4 strums (one per beat in 4/4 time)
      const beatsPerBar = timeSignature[0]
      const events: ChordEvent[] = []

      chordLineItems.forEach((item, chordIndex) => {
        // Each chord gets one bar, with a strum on each beat
        for (let beat = 0; beat < beatsPerBar; beat++) {
          events.push({
            id: generateId("chord-event"),
            time: `${chordIndex}:${beat}:0`, // bar:beat:sixteenth
            positions: item.positions,
            strum: "down" as const,
            duration: "4n",
            velocity: 0.8,
          })
        }
      })

      return events
    },
    [timeSignature]
  )

  // ============================================
  // BPM Management
  // ============================================
  const setBpm = useCallback((newBpm: number) => {
    const clampedBpm = Math.max(20, Math.min(300, newBpm))
    setBpmState(clampedBpm)
  }, [])

  return (
    <TabDataContext.Provider
      value={{
        // Legacy chord line
        chordLine,
        setChordLine,
        removeChordFromLine,
        reorderChordLine,
        clearChordLine,

        // Tracks
        tracks,
        setTracks,
        addTrack,
        removeTrack,
        updateTrack,

        // Note events
        addNoteEvent,
        removeNoteEvent,
        updateNoteEvent,

        // Chord events
        addChordEvent,
        removeChordEvent,
        updateChordEvent,

        // Conversion
        convertChordLineToEvents,

        // Timing
        bpm,
        setBpm,
        timeSignature,
        setTimeSignature,

        // Legacy
        tabData,
        setTabData,
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
