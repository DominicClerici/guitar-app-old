import { mkdir, readdir, writeFile } from "fs/promises"
import { NextRequest, NextResponse } from "next/server"
import path from "path"

const SAMPLES_DIR = path.join(process.cwd(), "..", "training-samples")

async function getNextIteration(stringNum: number, fret: number): Promise<number> {
  const dir = path.join(SAMPLES_DIR, stringNum.toString(), fret.toString())

  try {
    const files = await readdir(dir)
    const wavFiles = files.filter((f) => f.endsWith(".wav"))

    if (wavFiles.length === 0) return 1

    const iterations = wavFiles
      .map((f) => parseInt(f.replace(".wav", ""), 10))
      .filter((n) => !isNaN(n))

    return iterations.length > 0 ? Math.max(...iterations) + 1 : 1
  } catch {
    return 1
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const stringNum = parseInt(formData.get("string") as string, 10)
    const fret = parseInt(formData.get("fret") as string, 10)

    if (isNaN(stringNum) || stringNum < 1 || stringNum > 6) {
      return NextResponse.json({ error: "Invalid string number" }, { status: 400 })
    }

    if (isNaN(fret) || fret < 0 || fret > 24) {
      return NextResponse.json({ error: "Invalid fret number" }, { status: 400 })
    }

    const sampleDir = path.join(SAMPLES_DIR, stringNum.toString(), fret.toString())
    await mkdir(sampleDir, { recursive: true })

    let nextIteration = await getNextIteration(stringNum, fret)
    const savedFiles: string[] = []

    const sampleEntries = Array.from(formData.entries()).filter(([key]) =>
      key.startsWith("sample_"),
    )

    for (const [, file] of sampleEntries) {
      if (!(file instanceof Blob)) continue

      const buffer = Buffer.from(await file.arrayBuffer())
      const filename = `${nextIteration.toString().padStart(3, "0")}.wav`
      const filepath = path.join(sampleDir, filename)

      await writeFile(filepath, buffer)
      savedFiles.push(filepath)
      nextIteration++
    }

    return NextResponse.json({
      success: true,
      savedFiles: savedFiles.length,
      directory: sampleDir,
    })
  } catch (error) {
    console.error("Failed to save samples:", error)
    return NextResponse.json({ error: "Failed to save samples" }, { status: 500 })
  }
}
