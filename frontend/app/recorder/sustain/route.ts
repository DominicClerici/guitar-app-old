import { mkdir, readdir, writeFile } from "fs/promises"
import { NextResponse } from "next/server"
import { join } from "path"

const LAYER_SAMPLES_DIR = join(process.cwd(), "layer_samples")

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const stringIndex = formData.get("string")

    if (stringIndex === null) {
      return NextResponse.json({ error: "Missing string" }, { status: 400 })
    }

    const stringDir = join(LAYER_SAMPLES_DIR, String(stringIndex))

    await mkdir(stringDir, { recursive: true })

    let existingCount = 0
    try {
      const files = await readdir(stringDir)
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
        const filePath = join(stringDir, fileName)

        const arrayBuffer = await value.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        await writeFile(filePath, buffer)

        savedFiles.push(fileName)
      }
    }

    return NextResponse.json({
      success: true,
      savedFiles,
      directory: `layer_samples/${stringIndex}`,
    })
  } catch (error) {
    console.error("Failed to save sustain samples:", error)
    return NextResponse.json({ error: "Failed to save samples" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const counts: Record<string, number> = {}

    for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
      const stringDir = join(LAYER_SAMPLES_DIR, String(stringIndex))
      try {
        const files = await readdir(stringDir)
        const wavCount = files.filter((f) => f.endsWith(".wav")).length
        counts[String(stringIndex)] = wavCount
      } catch {
        counts[String(stringIndex)] = 0
      }
    }

    return NextResponse.json({ counts })
  } catch (error) {
    console.error("Failed to get sustain sample counts:", error)
    return NextResponse.json({ error: "Failed to get counts" }, { status: 500 })
  }
}
