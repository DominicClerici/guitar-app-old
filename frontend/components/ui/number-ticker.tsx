import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Minus, Plus } from "lucide-react"

interface NumberTickerProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

export default function NumberTicker({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className,
}: NumberTickerProps) {
  const handleDecrement = () => {
    const newValue = Math.max(min, value - step)
    onChange(newValue)
  }

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step)
    onChange(newValue)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    if (inputValue === "") {
      onChange(min)
      return
    }
    const numValue = parseInt(inputValue, 10)
    if (!isNaN(numValue)) {
      onChange(Math.min(max, Math.max(min, numValue)))
    }
  }

  return (
    <div className={cn("flex items-center", className)}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className="bg-background not-disabled:hover:bg-accent text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-l-md border border-r-0 transition-colors duration-75 not-disabled:cursor-pointer disabled:opacity-50"
      >
        <Minus className="size-4" />
      </button>
      <Input
        type="number"
        value={value}
        onChange={handleInputChange}
        min={min}
        max={max}
        step={step}
        className="bg-background/50! hover:bg-accent! border-border! h-9 w-16 [appearance:textfield] rounded-none border text-center font-mono text-lg! font-medium focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        className="bg-background not-disabled:hover:bg-accent text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-r-md border border-l-0 transition-colors duration-75 not-disabled:cursor-pointer disabled:opacity-50"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
