import { mkdir, readdir, writeFile } from "fs/promises"
import { NextResponse } from "next/server"
import { join } from "path"

const SAMPLES_DIR = join(process.cwd(), "samples")

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const stringIndex = formData.get("string")
    const fretIndex = formData.get("fret")

    if (stringIndex === null || fretIndex === null) {
      return NextResponse.json({ error: "Missing string or fret" }, { status: 400 })
    }

    const stringDir = join(SAMPLES_DIR, String(stringIndex))
    const fretDir = join(stringDir, String(fretIndex))

    await mkdir(fretDir, { recursive: true })

    let existingCount = 0
    try {
      const files = await readdir(fretDir)
      existingCount = files.filter((f) => f.endsWith(".wav")).length
    } catch {
      // Directory doesn't exist yet, start from 0
    }

    const savedFiles: string[] = []

    for (const [key, value] of formData.entries()) {
      if (key.startsWith("sample_") && value instanceof Blob) {
        const sampleIndex = parseInt(key.replace("sample_", ""), 10)
        const fileNumber = existingCount + sampleIndex + 1
        const fileName = String(fileNumber).padStart(3, "0") + ".wav"
        const filePath = join(fretDir, fileName)

        const arrayBuffer = await value.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        await writeFile(filePath, buffer)

        savedFiles.push(fileName)
      }
    }

    return NextResponse.json({
      success: true,
      savedFiles,
      directory: `samples/${stringIndex}/${fretIndex}`,
    })
  } catch (error) {
    console.error("Failed to save samples:", error)
    return NextResponse.json({ error: "Failed to save samples" }, { status: 500 })
  }
}
