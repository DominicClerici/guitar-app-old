import { cn } from "@/lib/utils"
import { InputProps } from "./input"

interface InputWithTickerProps extends InputProps {
  onValueChange: (value: number) => void
  value: number
  step: number
  min: number
  max: number
}

export default function InputWithTicker({
  className,
  onValueChange,
  value,
  step,
  min,
  max,
  ...props
}: InputWithTickerProps) {
  return (
    <div className="flex flex-col items-center rounded-md shadow-xs">
      <input
        type={"number"}
        data-slot="input"
        value={value}
        onChange={(e) => onValueChange(parseFloat(e.target.value))}
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-t-md border bg-transparent px-1 py-0.5 text-center font-mono text-sm transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-base",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className,
        )}
        {...props}
      />
      <div className="grid w-full grid-cols-2 grid-rows-1 items-stretch justify-stretch">
        <button
          disabled={value <= min}
          onClick={() => {
            onValueChange(value - step)
          }}
          className="hover:bg-accent h-5 w-full cursor-pointer rounded-bl-sm border border-t-0 border-r-0 text-center leading-0 select-none disabled:pointer-events-none disabled:opacity-50"
        >
          -
        </button>
        <button
          disabled={value >= max}
          onClick={() => {
            onValueChange(value + step)
          }}
          className="hover:bg-accent h-5 w-full cursor-pointer rounded-br-sm border border-t-0 border-l-0 text-center leading-0 select-none disabled:pointer-events-none disabled:opacity-50"
        >
          +
        </button>
      </div>
    </div>
  )
}
