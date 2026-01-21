"use client"

import { Slider } from "@/components/ui/slider"
import useTabs from "@/context/tabs-provider"

export function AudioEffectsControls() {
  const {
    effectsSettings,
    setMasterVolume,
    setReverbWet,
    setReverbRoomSize,
    setReverbDampening,
  } = useTabs()

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <h3 className="font-medium">Audio Effects</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm">Master Volume</label>
            <span className="text-muted-foreground text-xs">
              {Math.round(effectsSettings.masterVolume * 100)}%
            </span>
          </div>
          <Slider
            value={[effectsSettings.masterVolume]}
            onValueChange={([value]) => setMasterVolume(value)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm">Reverb Mix</label>
            <span className="text-muted-foreground text-xs">
              {Math.round(effectsSettings.reverbWet * 100)}%
            </span>
          </div>
          <Slider
            value={[effectsSettings.reverbWet]}
            onValueChange={([value]) => setReverbWet(value)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm">Room Size</label>
            <span className="text-muted-foreground text-xs">
              {Math.round(effectsSettings.reverbRoomSize * 100)}%
            </span>
          </div>
          <Slider
            value={[effectsSettings.reverbRoomSize]}
            onValueChange={([value]) => setReverbRoomSize(value)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm">Dampening</label>
            <span className="text-muted-foreground text-xs">
              {Math.round(effectsSettings.reverbDampening)} Hz
            </span>
          </div>
          <Slider
            value={[effectsSettings.reverbDampening]}
            onValueChange={([value]) => setReverbDampening(value)}
            min={200}
            max={10000}
            step={100}
          />
        </div>
      </div>
    </div>
  )
}
