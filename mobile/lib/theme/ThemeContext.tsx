import COLORS from "@/lib/theme/colors"
import { createContext, ReactNode, useContext, useState } from "react"

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
  const [theme, setTheme] = useState<Theme>("light")

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
