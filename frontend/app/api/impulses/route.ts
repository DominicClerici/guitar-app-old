import fs from "fs"
import { NextResponse } from "next/server"
import path from "path"

export type ImpulseResponseFile = {
  id: string
  name: string
  url: string
}

export async function GET() {
  try {
    const impulsesDir = path.join(process.cwd(), "public", "impulses")

    // Check if directory exists
    if (!fs.existsSync(impulsesDir)) {
      return NextResponse.json([])
    }

    const files = fs.readdirSync(impulsesDir)

    // Filter for audio files and create response objects
    const audioExtensions = [".wav", ".mp3", ".ogg", ".flac", ".aiff"]
    const impulses: ImpulseResponseFile[] = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase()
        return audioExtensions.includes(ext)
      })
      .map((file) => {
        const name = path.basename(file, path.extname(file))
        // Create URL-safe id from filename
        const id = name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
        return {
          id,
          name,
          url: `/impulses/${encodeURIComponent(file)}`,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json(impulses)
  } catch (error) {
    console.error("Error reading impulses directory:", error)
    return NextResponse.json([])
  }
}
