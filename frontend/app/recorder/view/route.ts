import { readdir } from "fs/promises"
import { NextResponse } from "next/server"
import { join } from "path"

const SAMPLES_DIR = join(process.cwd(), "samples")
const STRING_COUNT = 6
const FRET_COUNT = 19

export async function GET() {
  const counts: Record<string, number> = {}

  try {
    for (let stringIndex = 0; stringIndex < STRING_COUNT; stringIndex++) {
      for (let fretIndex = 0; fretIndex < FRET_COUNT; fretIndex++) {
        const fretDir = join(SAMPLES_DIR, String(stringIndex), String(fretIndex))

        try {
          const files = await readdir(fretDir)
          const wavCount = files.filter((f) => f.endsWith(".wav")).length
          if (wavCount > 0) {
            counts[`${stringIndex}-${fretIndex}`] = wavCount
          }
        } catch {
          // Directory doesn't exist, skip
        }
      }
    }

    return NextResponse.json({ counts })
  } catch (error) {
    console.error("Failed to read sample counts:", error)
    return NextResponse.json({ error: "Failed to read sample counts" }, { status: 500 })
  }
}
