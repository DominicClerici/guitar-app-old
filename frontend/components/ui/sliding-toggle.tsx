import { cn } from "@/lib/utils"
import { useEffect, useRef } from "react"

interface SlidingToggleProps {
  options: { label: string; value: string; icon?: React.ReactNode }[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export default function SlidingToggle({ options, value, onChange, className }: SlidingToggleProps) {
  const sliderRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sliderRef.current || !containerRef.current) return

    const optionElement = containerRef.current.querySelector(`#${value}`) as HTMLElement
    if (!optionElement) return
    sliderRef.current.style.opacity = "1"
    sliderRef.current.style.transform = `translateX(${optionElement.offsetLeft}px)`
    sliderRef.current.style.width = `${optionElement.offsetWidth}px`
  }, [value])

  return (
    <div
      ref={containerRef}
      className={cn("relative z-0 flex items-center rounded-lg border p-1", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          id={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-10 flex items-center gap-2 px-4 py-1.5 text-sm transition-colors duration-100 [&_svg]:size-4",
            value === option.value
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground cursor-pointer",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
      <div
        ref={sliderRef}
        className="bg-accent absolute top-1 bottom-1 left-0 rounded-md opacity-0 transition-all duration-200"
      />
    </div>
  )
}
