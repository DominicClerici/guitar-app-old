"use client"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import useFretboardContext from "./fretboard-context"

export default function FilterControls() {
  const { effects, setEffects, irPresets, irPresetsLoading } = useFretboardContext()
  return (
    <div className="flex flex-col gap-4">
      {/* Master Section */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">Master</h4>
        <label className="flex items-center justify-between text-sm">
          <span className="flex flex-col">
            <span>Master Volume</span>
            <span className="text-muted-foreground text-xs">
              {Math.round(effects.master.gain * 100)}%
            </span>
          </span>
          <Slider
            value={[effects.master.gain]}
            step={0.01}
            min={0}
            max={1}
            className="w-40"
            onValueChange={(value) =>
              setEffects({
                ...effects,
                master: { ...effects.master, gain: value[0] },
              })
            }
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="flex flex-col">
            <span>Sampler Volume</span>
            <span className="text-muted-foreground text-xs">{effects.sampler.volume} dB</span>
          </span>
          <Slider
            value={[effects.sampler.volume]}
            step={1}
            min={-24}
            max={0}
            className="w-40"
            onValueChange={(value) =>
              setEffects({
                ...effects,
                sampler: { ...effects.sampler, volume: value[0] },
              })
            }
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="flex flex-col">
            <span>Velocity Scale</span>
            <span className="text-muted-foreground text-xs">
              {Math.round(effects.velocityScale * 100)}%
            </span>
          </span>
          <Slider
            value={[effects.velocityScale]}
            step={0.05}
            min={0.1}
            max={1}
            className="w-40"
            onValueChange={(value) =>
              setEffects({
                ...effects,
                velocityScale: value[0],
              })
            }
          />
        </label>
      </div>

      {/* Reverb Section (Convolver) */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">Reverb (Convolution)</h4>
        <label className="flex items-center justify-between text-sm">
          Enable Reverb
          <Switch
            onCheckedChange={(checked) =>
              setEffects({
                ...effects,
                reverb: { ...effects.reverb, enabled: checked },
              })
            }
            checked={effects.reverb.enabled}
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="flex flex-col">
            <span>Impulse Response</span>
            <span className="text-muted-foreground text-xs">
              {irPresetsLoading ? "Loading..." : `${irPresets.length} available`}
            </span>
          </span>
          <Select
            value={effects.reverb.presetId}
            onValueChange={(value: string) =>
              setEffects({
                ...effects,
                reverb: { ...effects.reverb, presetId: value },
              })
            }
            disabled={irPresetsLoading || irPresets.length === 0}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select room..." />
            </SelectTrigger>
            <SelectContent>
              {irPresets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="flex flex-col">
            <span>Mix (Wet/Dry)</span>
            <span className="text-muted-foreground text-xs">
              {Math.round(effects.reverb.wet * 100)}% wet
            </span>
          </span>
          <Slider
            value={[effects.reverb.wet]}
            step={0.01}
            min={0}
            max={0.95}
            className="w-40"
            onValueChange={(value) =>
              setEffects({
                ...effects,
                reverb: { ...effects.reverb, wet: value[0] },
              })
            }
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="flex flex-col">
            <span>Pre-Delay</span>
            <span className="text-muted-foreground text-xs">
              {(effects.reverb.preDelay * 1000).toFixed(0)} ms
            </span>
          </span>
          <Slider
            value={[effects.reverb.preDelay]}
            step={0.001}
            min={0}
            max={0.1}
            className="w-40"
            onValueChange={(value) =>
              setEffects({
                ...effects,
                reverb: { ...effects.reverb, preDelay: value[0] },
              })
            }
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="flex flex-col">
            <span>High Cut</span>
            <span className="text-muted-foreground text-xs">
              {effects.reverb.highCut >= 1000
                ? `${(effects.reverb.highCut / 1000).toFixed(1)} kHz`
                : `${effects.reverb.highCut} Hz`}
            </span>
          </span>
          <Slider
            value={[effects.reverb.highCut]}
            step={100}
            min={1000}
            max={20000}
            className="w-40"
            onValueChange={(value) =>
              setEffects({
                ...effects,
                reverb: { ...effects.reverb, highCut: value[0] },
              })
            }
          />
        </label>
      </div>

      {/* Compressor Section */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">Compressor</h4>
        <label className="flex items-center justify-between text-sm">
          Enable Compressor
          <Switch
            onCheckedChange={(checked) =>
              setEffects({
                ...effects,
                compressor: { ...effects.compressor, enabled: checked },
              })
            }
            checked={effects.compressor.enabled}
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="flex flex-col">
            <span>Threshold</span>
            <span className="text-muted-foreground text-xs">{effects.compressor.threshold} dB</span>
          </span>
          <Slider
            value={[effects.compressor.threshold]}
            step={1}
            min={-48}
            max={0}
            className="w-40"
            onValueChange={(value) =>
              setEffects({
                ...effects,
                compressor: { ...effects.compressor, threshold: value[0] },
              })
            }
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="flex flex-col">
            <span>Ratio</span>
            <span className="text-muted-foreground text-xs">{effects.compressor.ratio}:1</span>
          </span>
          <Slider
            value={[effects.compressor.ratio]}
            step={0.5}
            min={1}
            max={20}
            className="w-40"
            onValueChange={(value) =>
              setEffects({
                ...effects,
                compressor: { ...effects.compressor, ratio: value[0] },
              })
            }
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="flex flex-col">
            <span>Attack</span>
            <span className="text-muted-foreground text-xs">
              {(effects.compressor.attack * 1000).toFixed(1)} ms
            </span>
          </span>
          <Slider
            value={[effects.compressor.attack]}
            step={0.001}
            min={0.001}
            max={0.1}
            className="w-40"
            onValueChange={(value) =>
              setEffects({
                ...effects,
                compressor: { ...effects.compressor, attack: value[0] },
              })
            }
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="flex flex-col">
            <span>Release</span>
            <span className="text-muted-foreground text-xs">
              {(effects.compressor.release * 1000).toFixed(0)} ms
            </span>
          </span>
          <Slider
            value={[effects.compressor.release]}
            step={0.01}
            min={0.01}
            max={1}
            className="w-40"
            onValueChange={(value) =>
              setEffects({
                ...effects,
                compressor: { ...effects.compressor, release: value[0] },
              })
            }
          />
        </label>
      </div>

      {/* Limiter Section */}
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">Limiter</h4>
        <label className="flex items-center justify-between text-sm">
          Enable Limiter
          <Switch
            onCheckedChange={(checked) =>
              setEffects({
                ...effects,
                limiter: { ...effects.limiter, enabled: checked },
              })
            }
            checked={effects.limiter.enabled}
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="flex flex-col">
            <span>Threshold</span>
            <span className="text-muted-foreground text-xs">{effects.limiter.threshold} dB</span>
          </span>
          <Slider
            value={[effects.limiter.threshold]}
            step={0.5}
            min={-12}
            max={0}
            className="w-40"
            onValueChange={(value) =>
              setEffects({
                ...effects,
                limiter: { ...effects.limiter, threshold: value[0] },
              })
            }
          />
        </label>
      </div>
    </div>
  )
}
