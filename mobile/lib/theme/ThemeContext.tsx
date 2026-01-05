import COLORS from "@/lib/theme/colors"
import { createContext, ReactNode, useContext, useState } from "react"

/**
 * Adds opacity to a hex color by appending an alpha value.
 * @param hex - A hex color string (e.g., "#ff0000" or "#f00")
 * @param opacity - A number between 0 and 1
 * @returns The hex color with alpha appended (e.g., "#ff000080" for 50% opacity)
 */
export function addOpacity(hex: string, opacity: number): string {
  const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0")
  return `${hex}${alpha}`
}

type Theme = "light" | "dark"
export type ThemeColors = (typeof COLORS)["dark"]

interface ThemeContextType {
  theme: Theme
  colors: ThemeColors
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"))
  const colors = COLORS[theme]

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}

export function useColors() {
  return useTheme().colors
}
