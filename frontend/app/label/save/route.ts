import { mkdir, writeFile } from "fs/promises"
import { NextResponse } from "next/server"
import { join } from "path"

const LABEL_SESSIONS_DIR = join(process.cwd(), "label_sessions")

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const audioBlob = formData.get("audio")
    const labelsJson = formData.get("labels")

    if (!(audioBlob instanceof Blob) || typeof labelsJson !== "string") {
      return NextResponse.json({ error: "Missing audio blob or labels JSON" }, { status: 400 })
    }

    const labels = JSON.parse(labelsJson)
    if (!labels.sampleRate || !labels.durationMs || !Array.isArray(labels.intervals)) {
      return NextResponse.json({ error: "Invalid labels format" }, { status: 400 })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const sessionDir = join(LABEL_SESSIONS_DIR, timestamp)
    await mkdir(sessionDir, { recursive: true })

    const audioArrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = Buffer.from(audioArrayBuffer)
    await writeFile(join(sessionDir, "audio.wav"), audioBuffer)

    await writeFile(join(sessionDir, "labels.json"), JSON.stringify(labels, null, 2))

    return NextResponse.json({
      success: true,
      directory: `label_sessions/${timestamp}`,
      intervalCount: labels.intervals.length,
    })
  } catch (error) {
    console.error("Failed to save labeling session:", error)
    return NextResponse.json({ error: "Failed to save labeling session" }, { status: 500 })
  }
}
