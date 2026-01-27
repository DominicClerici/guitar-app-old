"use client"

import SlidingToggle from "@/components/ui/sliding-toggle"
import { MusicIcon } from "lucide-react"

interface LearnPreviewProps {
  previewShape: string
  onShapeChange: (shape: string) => void
  showDegree: boolean
  onShowDegreeChange: (show: boolean) => void
  availableShapes: readonly string[]
  className?: string
}

export default function LearnPreview({
  previewShape,
  onShapeChange,
  showDegree,
  onShowDegreeChange,
  availableShapes,
  className,
}: LearnPreviewProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        Fretboard Preview
      </p>
      <div className="flex items-center justify-center gap-4">
        <SlidingToggle
          options={[
            { label: "Full", value: "full" },
            ...availableShapes.map((shape) => ({ label: shape, value: shape })),
          ]}
          value={previewShape}
          onChange={onShapeChange}
          className="h-12"
        />
        <SlidingToggle
          options={[
            {
              label: "Interval",
              value: "interval",
              icon: <span className="font-mono text-lg font-medium">1</span>,
            },
            { label: "Note", value: "note", icon: <MusicIcon /> },
          ]}
          value={showDegree ? "interval" : "note"}
          onChange={(value) => onShowDegreeChange(value === "interval")}
          className="h-12"
        />
      </div>
    </div>
  )
}
