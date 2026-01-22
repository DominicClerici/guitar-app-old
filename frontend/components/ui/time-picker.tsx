"use client"

import { cn } from "@/lib/utils"
import { useCallback, useEffect, useRef, useState } from "react"

interface TimePickerProps {
  value: { minutes: number; seconds: number }
  onChange: (value: { minutes: number; seconds: number }) => void
  className?: string
}

const ITEM_HEIGHT = 28
const VISIBLE_ITEMS = 5
const CENTER_INDEX = 2

const MINUTES = Array.from({ length: 60 }, (_, i) => i)
const SECONDS = Array.from({ length: 12 }, (_, i) => i * 5)

interface WheelProps {
  items: number[]
  value: number
  onChange: (value: number) => void
  label: string
  formatValue?: (value: number) => string
}

const FRICTION = 0.91
const INERTIA_STOP_VELOCITY = 0.1
const INERTIA_START_THRESHOLD = 5
const VELOCITY_SAMPLES = 5

function Wheel({ items, value, onChange, label, formatValue }: WheelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [visualIndex, setVisualIndex] = useState(() => items.indexOf(value))
  const dragStartY = useRef(0)
  const dragStartOffset = useRef(0)
  const currentOffset = useRef(0)
  const animationRef = useRef<number | null>(null)
  const velocityTracker = useRef<{ time: number; y: number }[]>([])
  const isAnimating = useRef(false)

  const currentIndex = items.indexOf(value)

  const getOffsetForIndex = useCallback((index: number) => -index * ITEM_HEIGHT, [])

  const updateVisualOffset = useCallback((offset: number, animate = false) => {
    currentOffset.current = offset
    setVisualIndex(-offset / ITEM_HEIGHT)
    if (containerRef.current) {
      containerRef.current.style.transition = animate ? "transform 75ms ease-out" : "none"
      containerRef.current.style.transform = `translateY(${offset + CENTER_INDEX * ITEM_HEIGHT}px)`
    }
  }, [])

  const snapToIndex = useCallback(
    (index: number, animate = true) => {
      const clampedIndex = Math.max(0, Math.min(items.length - 1, index))
      updateVisualOffset(getOffsetForIndex(clampedIndex), animate)
      if (items[clampedIndex] !== value) {
        onChange(items[clampedIndex])
      }
    },
    [items, value, onChange, updateVisualOffset, getOffsetForIndex],
  )

  const snapToIndexRef = useRef(snapToIndex)
  snapToIndexRef.current = snapToIndex

  const animateWithInertia = useCallback(
    (initialVelocity: number) => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }

      let velocity = initialVelocity
      isAnimating.current = true

      const animate = () => {
        if (!isAnimating.current) return

        velocity *= FRICTION
        currentOffset.current += velocity

        const maxOffset = 0
        const minOffset = -(items.length - 1) * ITEM_HEIGHT

        if (currentOffset.current > maxOffset) {
          currentOffset.current = maxOffset
          velocity = 0
        } else if (currentOffset.current < minOffset) {
          currentOffset.current = minOffset
          velocity = 0
        }

        updateVisualOffset(currentOffset.current, false)

        if (Math.abs(velocity) > INERTIA_STOP_VELOCITY) {
          animationRef.current = requestAnimationFrame(animate)
        } else {
          isAnimating.current = false
          const targetIndex = Math.round(-currentOffset.current / ITEM_HEIGHT)
          snapToIndexRef.current(targetIndex, true)
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    },
    [items.length, updateVisualOffset],
  )

  useEffect(() => {
    if (!isAnimating.current && !isDragging) {
      updateVisualOffset(getOffsetForIndex(currentIndex), false)
    }
  }, [currentIndex, getOffsetForIndex, updateVisualOffset, isDragging])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartY.current = e.clientY
    dragStartOffset.current = currentOffset.current
    velocityTracker.current = [{ time: performance.now(), y: e.clientY }]
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    isAnimating.current = false
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      const now = performance.now()
      velocityTracker.current.push({ time: now, y: e.clientY })
      if (velocityTracker.current.length > VELOCITY_SAMPLES) {
        velocityTracker.current.shift()
      }

      const deltaY = e.clientY - dragStartY.current
      const newOffset = dragStartOffset.current + deltaY
      const maxOffset = 0
      const minOffset = -(items.length - 1) * ITEM_HEIGHT
      const clampedOffset = Math.max(minOffset, Math.min(maxOffset, newOffset))
      updateVisualOffset(clampedOffset, false)
    },
    [isDragging, items.length, updateVisualOffset],
  )

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    const samples = velocityTracker.current
    let velocity = 0

    if (samples.length >= 2) {
      const recent = samples[samples.length - 1]
      const older = samples[0]
      const timeDelta = recent.time - older.time
      if (timeDelta > 0) {
        velocity = ((recent.y - older.y) / timeDelta) * 16
      }
    }

    if (Math.abs(velocity) > INERTIA_START_THRESHOLD) {
      animateWithInertia(velocity)
    } else {
      const targetIndex = Math.round(-currentOffset.current / ITEM_HEIGHT)
      snapToIndex(targetIndex, true)
    }
  }, [isDragging, snapToIndex, animateWithInertia])

  useEffect(() => {
    const container = containerRef.current?.parentElement
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      isAnimating.current = false
      const direction = e.deltaY > 0 ? 1 : -1
      const currentIdx = items.indexOf(value)
      const newIndex = currentIdx + direction
      snapToIndexRef.current(newIndex, true)
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [items, value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault()
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
        isAnimating.current = false
        snapToIndex(currentIndex - 1, true)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
        isAnimating.current = false
        snapToIndex(currentIndex + 1, true)
      }
    },
    [currentIndex, snapToIndex],
  )

  const format = formatValue ?? ((v: number) => v.toString().padStart(2, "0"))

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <div
        className="border-border bg-background focus-within:ring-ring relative w-26 cursor-grab overflow-hidden rounded-lg border focus-within:ring-2 focus-within:ring-offset-2 active:cursor-grabbing"
        style={{
          height: `${ITEM_HEIGHT * VISIBLE_ITEMS}px`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`${label}-${value}`}
      >
        <div className="from-background pointer-events-none absolute inset-x-0 top-0 z-10 h-13 bg-gradient-to-b to-transparent" />
        <div className="from-background pointer-events-none absolute inset-x-0 bottom-0 z-10 h-13 bg-gradient-to-t to-transparent" />

        <div
          className="bg-primary/10 border-primary/20 pointer-events-none absolute inset-x-2 z-20 rounded-md border"
          style={{
            top: CENTER_INDEX * ITEM_HEIGHT - 2.5,
            height: ITEM_HEIGHT + 5,
          }}
        />

        <div ref={containerRef} className="absolute inset-x-0" style={{ willChange: "transform" }}>
          {items.map((item, index) => {
            const distance = Math.abs(index - visualIndex)
            const opacity = distance > 2 ? 0 : 1 - distance * 0.3
            const scale = distance > 2 ? 0.8 : 1 - distance * 0.08
            const rotateX = (index - visualIndex) * 20

            return (
              <div
                key={item}
                id={`${label}-${item}`}
                role="option"
                aria-selected={item === value}
                className="flex items-center justify-center will-change-transform select-none"
                style={{
                  opacity,
                  height: `${ITEM_HEIGHT}px`,
                  transform: `perspective(200px) rotateX(${-rotateX}deg) scale(${scale})`,
                  transition: isDragging || isAnimating.current ? "none" : "all 150ms ease-out",
                }}
              >
                <span
                  className={cn(
                    "font-mono text-xl font-semibold tabular-nums",
                    item === value ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {format(item)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function TimePicker({ value, onChange, className }: TimePickerProps) {
  const handleMinutesChange = useCallback(
    (minutes: number) => {
      onChange({ ...value, minutes })
    },
    [value, onChange],
  )

  const handleSecondsChange = useCallback(
    (seconds: number) => {
      onChange({ ...value, seconds })
    },
    [value, onChange],
  )

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Wheel items={MINUTES} value={value.minutes} onChange={handleMinutesChange} label="min" />
      <span className="text-muted-foreground text-2xl font-bold">:</span>
      <Wheel items={SECONDS} value={value.seconds} onChange={handleSecondsChange} label="sec" />
    </div>
  )
}
