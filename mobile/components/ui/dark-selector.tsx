import Button from "@/components/ui/button"
import { useTheme } from "@/lib/theme/ThemeContext"

export default function DarkSelector() {
  const { theme, toggleTheme } = useTheme()
  return <Button onPress={toggleTheme}>{theme === "dark" ? "Dark" : "Light"}</Button>
}
