import { formatHex8, parse } from "culori"
import * as fs from "fs"
import * as path from "path"

import COLORS from "./colors_OKLCH"

type ColorValue = string
type ColorTheme = Record<string, ColorValue>
type Colors = {
  dark: ColorTheme
  light: ColorTheme
}

function oklchToHex(oklchColor: string): string {
  const parsed = parse(oklchColor)
  if (!parsed) {
    console.warn(`Could not parse color: ${oklchColor}`)
    return oklchColor
  }
  // Use formatHex8 to preserve alpha channel
  const hex = formatHex8(parsed)
  if (!hex) return oklchColor
  // If fully opaque (ends with ff), return 6-digit hex
  if (hex.endsWith("ff")) {
    return hex.slice(0, 7)
  }
  return hex
}

function convertTheme(theme: ColorTheme): ColorTheme {
  const converted: ColorTheme = {}
  for (const [key, value] of Object.entries(theme)) {
    converted[key] = oklchToHex(value)
  }
  return converted
}

function convertColors(colors: Colors): Colors {
  return {
    dark: convertTheme(colors.dark),
    light: convertTheme(colors.light),
  }
}

function generateFileContent(colors: Colors): string {
  const lines: string[] = ["const COLORS = {"]

  for (const [themeName, theme] of Object.entries(colors)) {
    lines.push(`  ${themeName}: {`)
    for (const [key, value] of Object.entries(theme)) {
      lines.push(`    ${key}: "${value}",`)
    }
    lines.push("  },")
  }

  lines.push("}")
  lines.push("")
  lines.push("export default COLORS")
  lines.push("")

  return lines.join("\n")
}

function main() {
  console.log("Converting OKLCH colors to hex...")

  const convertedColors = convertColors(COLORS)

  const outputPath = path.join(__dirname, "colors.ts")
  const content = generateFileContent(convertedColors)

  fs.writeFileSync(outputPath, content, "utf-8")

  console.log(`Converted colors written to ${outputPath}`)
}

main()
