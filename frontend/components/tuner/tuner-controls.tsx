"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { AlertCircle, Mic, MicOff, Volume2 } from "lucide-react"

export interface TuningString {
  note: string
  frequency: number
}

export interface TuningPreset {
  id: string
  name: string
  strings: TuningString[]
}

export const TUNING_PRESETS: TuningPreset[] = [
  {
    id: "standard",
    name: "Standard",
    strings: [
      { note: "E2", frequency: 82.41 },
      { note: "A2", frequency: 110.0 },
      { note: "D3", frequency: 146.83 },
      { note: "G3", frequency: 196.0 },
      { note: "B3", frequency: 246.94 },
      { note: "E4", frequency: 329.63 },
    ],
  },
  {
    id: "drop-d",
    name: "Drop D",
    strings: [
      { note: "D2", frequency: 73.42 },
      { note: "A2", frequency: 110.0 },
      { note: "D3", frequency: 146.83 },
      { note: "G3", frequency: 196.0 },
      { note: "B3", frequency: 246.94 },
      { note: "E4", frequency: 329.63 },
    ],
  },
  {
    id: "half-step-down",
    name: "Half Step Down",
    strings: [
      { note: "Eb2", frequency: 77.78 },
      { note: "Ab2", frequency: 103.83 },
      { note: "Db3", frequency: 138.59 },
      { note: "Gb3", frequency: 185.0 },
      { note: "Bb3", frequency: 233.08 },
      { note: "Eb4", frequency: 311.13 },
    ],
  },
  {
    id: "drop-c",
    name: "Drop C",
    strings: [
      { note: "C2", frequency: 65.41 },
      { note: "G2", frequency: 98.0 },
      { note: "C3", frequency: 130.81 },
      { note: "F3", frequency: 174.61 },
      { note: "A3", frequency: 220.0 },
      { note: "D4", frequency: 293.66 },
    ],
  },
  {
    id: "open-g",
    name: "Open G",
    strings: [
      { note: "D2", frequency: 73.42 },
      { note: "G2", frequency: 98.0 },
      { note: "D3", frequency: 146.83 },
      { note: "G3", frequency: 196.0 },
      { note: "B3", frequency: 246.94 },
      { note: "D4", frequency: 293.66 },
    ],
  },
  {
    id: "dadgad",
    name: "DADGAD",
    strings: [
      { note: "D2", frequency: 73.42 },
      { note: "A2", frequency: 110.0 },
      { note: "D3", frequency: 146.83 },
      { note: "G3", frequency: 196.0 },
      { note: "A3", frequency: 220.0 },
      { note: "D4", frequency: 293.66 },
    ],
  },
]

type TunerStatus = "idle" | "requesting" | "recording" | "error"

interface TunerControlsProps {
  status: TunerStatus
  error: string | null
  isMicEnabled: boolean
  selectedTuning: string
  onMicToggle: () => void
  onTuningChange: (tuningId: string) => void
}

export default function TunerControls({
  status,
  error,
  isMicEnabled,
  selectedTuning,
  onMicToggle,
  onTuningChange,
}: TunerControlsProps) {
  const getStatusDisplay = () => {
    switch (status) {
      case "idle":
        return {
          text: "Microphone off",
          color: "text-muted-foreground",
          bgColor: "bg-muted/50",
        }
      case "requesting":
        return {
          text: "Requesting access...",
          color: "text-info-foreground",
          bgColor: "bg-info-background",
        }
      case "recording":
        return {
          text: "Listening",
          color: "text-in-tune",
          bgColor: "bg-in-tune/10",
        }
      case "error":
        return {
          text: "Error",
          color: "text-out-of-tune",
          bgColor: "bg-out-of-tune/10",
        }
    }
  }

  const statusDisplay = getStatusDisplay()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-full transition-colors",
              isMicEnabled ? "bg-in-tune/15 text-in-tune" : "bg-muted text-muted-foreground",
            )}
          >
            {isMicEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">Microphone</span>
            <span className={cn("text-xs", statusDisplay.color)}>{statusDisplay.text}</span>
          </div>
        </div>

        <Switch checked={isMicEnabled} onCheckedChange={onMicToggle} />
      </div>

      {error && (
        <div className="bg-destructive-background border-destructive-border text-destructive-foreground flex items-start gap-2 rounded-lg border p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-border h-px" />

      <div className="flex flex-col gap-2">
        <label
          id="tuning-preset-label"
          className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          Tuning Preset
        </label>
        <Select
          value={selectedTuning}
          onValueChange={onTuningChange}
          aria-labelledby="tuning-preset-label"
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select tuning" />
          </SelectTrigger>
          <SelectContent>
            {TUNING_PRESETS.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{preset.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {preset.strings.map((s) => s.note.replace(/[0-9]/g, "")).join(" ")}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {status === "recording" && (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-in-tune/60 h-3 w-1 rounded-full"
                style={{
                  animation: `wave-pulse 1s ease-in-out ${i * 0.1}s infinite`,
                  transformOrigin: "bottom",
                }}
              />
            ))}
          </div>
          <Volume2 className="text-in-tune/60 size-4" />
          <span className="text-in-tune/80 text-xs">Audio detected</span>
        </div>
      )}
    </div>
  )
}

export type { TunerStatus }
