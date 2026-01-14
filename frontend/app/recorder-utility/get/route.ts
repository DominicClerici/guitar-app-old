import { readdir } from "fs/promises"
import { NextResponse } from "next/server"
import path from "path"

const SAMPLES_DIR = path.join(process.cwd(), "..", "training-samples")

type SampleCounts = Record<string, Record<string, number>>

export async function GET() {
  try {
    const counts: SampleCounts = {}

    for (let stringNum = 1; stringNum <= 6; stringNum++) {
      counts[stringNum] = {}
      const stringDir = path.join(SAMPLES_DIR, stringNum.toString())

      let fretDirs: string[] = []
      try {
        fretDirs = await readdir(stringDir)
      } catch {
        continue
      }

      for (const fretDir of fretDirs) {
        const fretNum = parseInt(fretDir, 10)
        if (isNaN(fretNum) || fretNum < 0 || fretNum > 24) continue

        const fretPath = path.join(stringDir, fretDir)
        try {
          const files = await readdir(fretPath)
          const wavFiles = files.filter((f) => f.endsWith(".wav"))
          if (wavFiles.length > 0) {
            counts[stringNum][fretNum] = wavFiles.length
          }
        } catch {
          continue
        }
      }
    }

    return NextResponse.json({ counts })
  } catch (error) {
    console.error("Failed to read samples:", error)
    return NextResponse.json({ error: "Failed to read samples" }, { status: 500 })
  }
}
