"use client"
import { applyTuningToNoteCharacter, getNoteFromFret } from "@/lib/midi-utils"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { STANDARD_TUNING_NOTES } from "../tab-editor/context/tab-player-context"
import { Tuning } from "../tab-editor/context/tab-tuning-context"
import { FretPositions } from "./fretboard-context"

export const NUM_STRINGS = 6
export const NUM_FRETS = 18 // 0 (open) through 17
const FRET_WIDTH = 70
const STRING_SPACING = 35
const NUT_WIDTH = 35
const TOP_PADDING = 40
const LEFT_PADDING = 30

interface FretboardCanvasProps {
  fretPositions: FretPositions
  setFretPositions: React.Dispatch<React.SetStateAction<FretPositions>>
  tuning: Tuning
}

export default function FretboardCanvas({
  fretPositions,
  setFretPositions,
  tuning,
}: FretboardCanvasProps) {
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null)
  const notesCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [canvasDimensions, setCanvasDimensions] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })

  const getStringY = useCallback((stringIndex: number) => {
    // String 0 is the high E (thinnest), string 5 is the low E (thickest)
    // Draw from top to bottom: high E at top, low E at bottom
    return TOP_PADDING + stringIndex * STRING_SPACING
  }, [])

  const getFretX = useCallback((fret: number) => {
    if (fret === 0) {
      // Open string position (before the nut)
      return LEFT_PADDING + NUT_WIDTH / 2
    }
    // Fret positions after the nut
    return LEFT_PADDING + NUT_WIDTH + (fret - 1) * FRET_WIDTH + FRET_WIDTH / 2
  }, [])

  // Memoize tuned notes to avoid recalculating on every render
  const tunedNotes = useMemo(() => {
    const notes = STANDARD_TUNING_NOTES.map((note, index) =>
      applyTuningToNoteCharacter(note, tuning[index]),
    )
    // Use lowercase 'e' for high E string
    if (notes[0] === "E") {
      notes[0] = "e"
    }
    return notes
  }, [tuning])

  // Draw static background elements (fretboard, frets, strings, markers)
  const drawBackground = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (canvasDimensions.width === 0 || canvasDimensions.height === 0) {
        return
      }

      // Clear canvas
      ctx.fillStyle = "#f5f5dc" // Fretboard wood color
      ctx.fillRect(0, 0, canvasDimensions.width, canvasDimensions.height)

      // Draw the nut (thick bar at fret 0)
      ctx.fillStyle = "#d4c4a8"
      ctx.fillRect(
        LEFT_PADDING,
        TOP_PADDING - 10,
        NUT_WIDTH,
        (NUM_STRINGS - 1) * STRING_SPACING + 20,
      )
      ctx.strokeStyle = "#333"
      ctx.lineWidth = 2
      ctx.strokeRect(
        LEFT_PADDING,
        TOP_PADDING - 10,
        NUT_WIDTH,
        (NUM_STRINGS - 1) * STRING_SPACING + 20,
      )

      // Draw frets (vertical lines)
      ctx.strokeStyle = "#888"
      ctx.lineWidth = 3
      for (let fret = 1; fret < NUM_FRETS; fret++) {
        const x = LEFT_PADDING + NUT_WIDTH + (fret - 1) * FRET_WIDTH + FRET_WIDTH
        ctx.beginPath()
        ctx.moveTo(x, TOP_PADDING - 5)
        ctx.lineTo(x, TOP_PADDING + (NUM_STRINGS - 1) * STRING_SPACING + 5)
        ctx.stroke()
      }

      // Draw fret numbers
      ctx.fillStyle = "#333"
      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      ctx.textBaseline = "alphabetic"
      for (let fret = 0; fret < NUM_FRETS; fret++) {
        const x = getFretX(fret)
        ctx.fillText(fret.toString(), x, TOP_PADDING - 20)
      }

      // Draw fret markers (dots on frets 3, 5, 7, 9, 12, 15)
      const markerFrets = [3, 5, 7, 9, 15]
      ctx.fillStyle = "#ddd"
      for (const fret of markerFrets) {
        const x = getFretX(fret)
        const y = TOP_PADDING + ((NUM_STRINGS - 1) * STRING_SPACING) / 2
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.fill()
      }
      // Double dot on 12th fret
      const fret12X = getFretX(12)
      const y1 = TOP_PADDING + STRING_SPACING * 1.5
      const y2 = TOP_PADDING + STRING_SPACING * 3.5
      ctx.beginPath()
      ctx.arc(fret12X, y1, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(fret12X, y2, 8, 0, Math.PI * 2)
      ctx.fill()

      // Draw strings (horizontal lines)
      const stringThicknesses = [0.6, 0.78, 1.02, 1.56, 2.16, 3.76] // 10-46 diameter * 60
      for (let string = 0; string < NUM_STRINGS; string++) {
        const y = getStringY(string)
        ctx.strokeStyle = "#666"
        ctx.lineWidth = stringThicknesses[string]
        ctx.beginPath()
        ctx.moveTo(LEFT_PADDING, y)
        ctx.lineTo(canvasDimensions.width - 20, y)
        ctx.stroke()
      }

      // Draw string labels based on tuning
      ctx.fillStyle = "#333"
      ctx.font = "14px Arial"
      ctx.textAlign = "right"
      ctx.textBaseline = "alphabetic"
      for (let string = 0; string < NUM_STRINGS; string++) {
        const y = getStringY(string)
        ctx.fillText(tunedNotes[string], LEFT_PADDING - 10, y + 5)
      }
    },
    [canvasDimensions.width, canvasDimensions.height, getFretX, getStringY, tunedNotes],
  )

  // Draw dynamic elements (placed notes)
  const drawNotes = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (canvasDimensions.width === 0 || canvasDimensions.height === 0) {
        return
      }

      // Clear the notes canvas (transparent background)
      ctx.clearRect(0, 0, canvasDimensions.width, canvasDimensions.height)

      // Draw placed notes with note in circle
      ctx.fillStyle = "#3b82f6" // Tailwind blue-500
      for (let string = 0; string < NUM_STRINGS; string++) {
        const fret = fretPositions[string]
        const note = getNoteFromFret(fret, tunedNotes[string] === "e" ? "E" : tunedNotes[string])
        if (fret >= 0) {
          const x = getFretX(fret)
          const y = getStringY(string)
          ctx.beginPath()
          ctx.arc(x, y, 10, 0, Math.PI * 2)
          ctx.fill()
          // Draw white border for visibility
          ctx.strokeStyle = "#fff"
          ctx.lineWidth = 1
          ctx.stroke()
          // Draw note centered in the dot
          ctx.fillStyle = "white"
          ctx.font = "bold 14px Arial"
          ctx.textAlign = "center"
          ctx.textBaseline = "middle"
          ctx.fillText(note, x, y)
          // Restore fillStyle for next circle
          ctx.fillStyle = "#3b82f6"
        }
      }
    },
    [
      canvasDimensions.width,
      canvasDimensions.height,
      fretPositions,
      getFretX,
      getStringY,
      tunedNotes,
    ],
  )

  // Handle resize - update dimensions
  useEffect(() => {
    const updateDimensions = () => {
      const container = canvasContainerRef.current
      if (!container) {
        console.error("Container not found")
        return
      }
      setCanvasDimensions({
        width: container.clientWidth,
        // TODO: make this responsive
        height: 240,
      })
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)

    return () => {
      window.removeEventListener("resize", updateDimensions)
    }
  }, [])

  // Draw background layer (only when dimensions or tuning change)
  useEffect(() => {
    const ctx = backgroundCanvasRef.current?.getContext("2d")
    if (!ctx) return
    drawBackground(ctx)
  }, [drawBackground])

  // Draw notes layer (when fret positions change)
  useEffect(() => {
    const ctx = notesCanvasRef.current?.getContext("2d")
    if (!ctx) return
    drawNotes(ctx)
  }, [drawNotes])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = notesCanvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY

      // Determine which string was clicked
      let clickedString = -1
      for (let string = 0; string < NUM_STRINGS; string++) {
        const stringY = getStringY(string)
        if (Math.abs(y - stringY) < STRING_SPACING / 2) {
          clickedString = string
          break
        }
      }

      if (clickedString === -1) return

      // Determine which fret was clicked
      let clickedFret = -1

      // Check open string area (fret 0)
      if (x >= LEFT_PADDING && x < LEFT_PADDING + NUT_WIDTH) {
        clickedFret = 0
      } else {
        // Check frets 1-15
        for (let fret = 1; fret < NUM_FRETS; fret++) {
          const fretStartX = LEFT_PADDING + NUT_WIDTH + (fret - 1) * FRET_WIDTH
          const fretEndX = fretStartX + FRET_WIDTH
          if (x >= fretStartX && x < fretEndX) {
            clickedFret = fret
            break
          }
        }
      }

      if (clickedFret === -1) return

      setFretPositions((prev) => {
        const newPositions = [...prev] as FretPositions
        if (newPositions[clickedString] === clickedFret) {
          newPositions[clickedString] = -1
        } else {
          newPositions[clickedString] = clickedFret
        }
        return newPositions
      })
    },
    [getStringY],
  )

  return (
    <div
      ref={canvasContainerRef}
      className="4xl:max-w-7xl 3xl:max-w-6xl relative mx-auto w-full max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl"
    >
      {/* Background layer - static fretboard elements */}
      <canvas
        ref={backgroundCanvasRef}
        width={canvasDimensions.width}
        height={canvasDimensions.height}
        className="rounded-lg border border-gray-300 shadow-md"
      />
      {/* Notes layer - dynamic elements, receives click events */}
      <canvas
        ref={notesCanvasRef}
        width={canvasDimensions.width}
        height={canvasDimensions.height}
        onClick={handleCanvasClick}
        className="absolute top-0 left-0 cursor-pointer"
      />
    </div>
  )
}
