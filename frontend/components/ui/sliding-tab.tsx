"use client"

import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

interface SlidingTabProps {
  options: { label: string; value: string; icon?: LucideIcon; tooltip?: string }[]
  value: string
  onChange: (value: string) => void
  className?: {
    container?: string
    slider?: string
    option?: string
    tooltip?: string
  }
}

export default function SlidingTab({ options, value, onChange, className }: SlidingTabProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

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
      className={cn(
        "bg-muted relative inline-flex w-fit cursor-pointer rounded-lg p-0.5",
        className?.container,
      )}
    >
      <div
        ref={sliderRef}
        className={cn(
          "bg-background absolute top-0.5 bottom-0.5 left-0 z-0 rounded-md opacity-0 transition-all duration-200",
          className?.slider,
        )}
      />

      {options.map((option) =>
        option.tooltip ? (
          <Tooltip key={`sliding-tab-${option.value}`}>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "relative z-10 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-75",
                  value === option.value
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground cursor-pointer",
                  className?.option,
                )}
                id={option.value}
                onClick={() => onChange(option.value)}
              >
                {option.label}
                {option.icon && <option.icon className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{option.tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          <button
            className={cn(
              "relative z-10 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-75",
              value === option.value
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground cursor-pointer",
              className?.option,
            )}
            key={`sliding-tab-${option.value}`}
            id={option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.icon && <option.icon className="size-4" />}
          </button>
        ),
      )}
    </div>
  )
}
