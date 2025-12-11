import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import useFretboardContext from "./fretboard-context"

export default function FilterControls() {
  const { effects, setEffects } = useFretboardContext()
  return (
    <div className="flex flex-col gap-2">
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
          <span>Reverb Size</span>
          {effects.reverb.roomSize}
        </span>
        <Slider
          value={[effects.reverb.roomSize]}
          step={0.01}
          min={0}
          max={1}
          className="w-40"
          onValueChange={(value) =>
            setEffects({
              ...effects,
              reverb: { ...effects.reverb, roomSize: value[0] },
            })
          }
        />
      </label>
      <label className="flex items-center justify-between text-sm">
        <span className="flex flex-col">
          <span>Reverb Wetness</span>
          {effects.reverb.wet}
        </span>
        <Slider
          value={[effects.reverb.wet]}
          step={0.01}
          min={0}
          max={1}
          className="w-40"
          onValueChange={(value) =>
            setEffects({
              ...effects,
              reverb: { ...effects.reverb, wet: value[0] },
            })
          }
        />
      </label>
    </div>
  )
}
