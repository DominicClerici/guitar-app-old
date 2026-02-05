import { exec } from "child_process"
import { randomUUID } from "crypto"
import { mkdir, readdir, rm, writeFile } from "fs/promises"
import { NextResponse } from "next/server"
import { join } from "path"
import { promisify } from "util"

const execAsync = promisify(exec)

const STRING_NN_DIR = join(process.cwd(), "..", "string-nn")
const TEMP_DIR = join(process.cwd(), "temp")
const PUBLIC_MODELS_DIR = join(process.cwd(), "public", "models")
const FINETUNE_SAMPLES_DIR = join(process.cwd(), "finetune_samples")

export async function POST(request: Request) {
  let tempUserDir: string | null = null

  try {
    const formData = await request.formData()

    const userId = formData.get("userId") as string | null
    const actualUserId = userId || randomUUID().slice(0, 8)

    tempUserDir = join(TEMP_DIR, `finetune_${actualUserId}`)
    await mkdir(tempUserDir, { recursive: true })

    const samplesByStringAndFret: Map<string, { index: number; blob: Blob }[]> = new Map()

    for (const [key, value] of formData.entries()) {
      if (key.startsWith("sample_") && value instanceof Blob) {
        const parts = key.split("_")
        const stringIndex = parseInt(parts[1], 10)
        const fretPosition = parseInt(parts[2], 10)
        const sampleIndex = parseInt(parts[3], 10)
        const mapKey = `${stringIndex}_${fretPosition}`

        if (!samplesByStringAndFret.has(mapKey)) {
          samplesByStringAndFret.set(mapKey, [])
        }
        samplesByStringAndFret.get(mapKey)!.push({ index: sampleIndex, blob: value })
      }
    }

    if (samplesByStringAndFret.size === 0) {
      return NextResponse.json({ error: "No samples provided" }, { status: 400 })
    }

    const savedFiles: string[] = []
    for (const [mapKey, samples] of samplesByStringAndFret) {
      const [stringIndex, fretPosition] = mapKey.split("_")
      const stringDir = join(tempUserDir, "samples", stringIndex, fretPosition)
      await mkdir(stringDir, { recursive: true })

      const persistentDir = join(FINETUNE_SAMPLES_DIR, stringIndex, fretPosition)
      await mkdir(persistentDir, { recursive: true })

      const existingFiles = await readdir(persistentDir).catch(() => [])
      const existingNumbers = existingFiles
        .filter((f) => f.endsWith(".wav"))
        .map((f) => parseInt(f.replace(".wav", ""), 10))
        .filter((n) => !isNaN(n))
      const nextIndex = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 0

      for (const sample of samples) {
        const fileName = `${String(sample.index).padStart(3, "0")}.wav`
        const filePath = join(stringDir, fileName)

        const arrayBuffer = await sample.blob.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        await writeFile(filePath, buffer)

        const persistentFileName = `${String(nextIndex + sample.index).padStart(3, "0")}.wav`
        const persistentFilePath = join(persistentDir, persistentFileName)
        await writeFile(persistentFilePath, buffer)

        savedFiles.push(`${stringIndex}/${fretPosition}/${fileName}`)
      }
    }

    console.log(
      `Saved ${savedFiles.length} samples for fine-tuning (also persisted to finetune_samples/)`,
    )

    const featuresDir = join(tempUserDir, "features")
    await mkdir(featuresDir, { recursive: true })

    const extractCmd = `python "${join(STRING_NN_DIR, "main.py")}" --samples-dir "${join(tempUserDir, "samples")}" --output-dir "${featuresDir}" --no-augment`

    console.log("Running feature extraction...")
    try {
      await execAsync(extractCmd, { cwd: STRING_NN_DIR, timeout: 60000 })
    } catch (extractError) {
      console.error("Feature extraction failed:", extractError)
      return NextResponse.json({ error: "Feature extraction failed" }, { status: 500 })
    }

    const featureFiles = await readdir(featuresDir)
    const jsonFiles = featureFiles.filter((f) => f.endsWith(".json"))
    if (jsonFiles.length === 0) {
      return NextResponse.json({ error: "No features extracted" }, { status: 500 })
    }
    const featuresFile = join(featuresDir, jsonFiles[jsonFiles.length - 1])

    console.log("Running fine-tuning...")
    const finetuneCmd = `python "${join(STRING_NN_DIR, "finetune.py")}" "${featuresFile}" --user-id "${actualUserId}"`

    try {
      const { stdout, stderr } = await execAsync(finetuneCmd, {
        cwd: STRING_NN_DIR,
        timeout: 120000,
      })
      console.log("Fine-tuning output:", stdout)
      if (stderr) console.error("Fine-tuning stderr:", stderr)
    } catch (finetuneError) {
      console.error("Fine-tuning failed:", finetuneError)
      return NextResponse.json({ error: "Fine-tuning failed" }, { status: 500 })
    }

    const finetunedModelPath = join(
      STRING_NN_DIR,
      "data",
      "models",
      "finetuned",
      `string_classifier_${actualUserId}.pt`,
    )

    console.log("Exporting to ONNX...")
    const userModelsDir = join(PUBLIC_MODELS_DIR, `user_${actualUserId}`)
    await mkdir(userModelsDir, { recursive: true })

    const exportCmd = `python "${join(STRING_NN_DIR, "export_onnx.py")}" --model-path "${finetunedModelPath}" --output-dir "${userModelsDir}"`

    try {
      await execAsync(exportCmd, { cwd: STRING_NN_DIR, timeout: 60000 })
    } catch (exportError) {
      console.error("ONNX export failed:", exportError)
      return NextResponse.json({ error: "ONNX export failed" }, { status: 500 })
    }

    if (tempUserDir) {
      await rm(tempUserDir, { recursive: true, force: true }).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      userId: actualUserId,
      modelPath: `/models/user_${actualUserId}/string_classifier.onnx`,
      scalerPath: `/models/user_${actualUserId}/scaler.json`,
      samplesProcessed: savedFiles.length,
    })
  } catch (error) {
    console.error("Fine-tuning error:", error)

    if (tempUserDir) {
      await rm(tempUserDir, { recursive: true, force: true }).catch(() => {})
    }

    return NextResponse.json({ error: "Fine-tuning failed" }, { status: 500 })
  }
}
