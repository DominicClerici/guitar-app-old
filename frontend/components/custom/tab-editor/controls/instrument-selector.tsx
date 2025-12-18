import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InstrumentName } from "@/lib/SampleLibrary"
import { useTabInstrumentContext } from "../context/tab-instrument-context"

interface InstrumentSelectorProps {
  selectedCategory: string
}

export default function InstrumentSelector({ selectedCategory }: InstrumentSelectorProps) {
  const { instrument, changeInstrument } = useTabInstrumentContext()
  if (selectedCategory.startsWith("chord")) {
    // TODO: only show guitar and synth instruments
  }
  if (selectedCategory.startsWith("bass")) {
    // TODO: only show guitar and synth instruments
  }
  if (selectedCategory.startsWith("drum")) {
    // TODO: only show drum instruments
  }
  return (
    <Select value={instrument} onValueChange={(value) => changeInstrument(value as InstrumentName)}>
      <SelectTrigger>
        <SelectValue placeholder="Select an instrument" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="guitar-acoustic">Acoustic Guitar</SelectItem>
        <SelectItem value="guitar-classical">Classical Guitar</SelectItem>
        <SelectItem value="guitar-12-string">12-String Guitar</SelectItem>
      </SelectContent>
    </Select>
  )
}
