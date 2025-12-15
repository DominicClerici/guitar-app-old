import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InstrumentName } from "@/lib/SampleLibrary"
import useFretboardContext from "./fretboard-context"

export default function FretboardInstrument() {
  const { instrument, changeInstrument } = useFretboardContext()
  return (
    <Card>
      <h3 className="mb-2 text-xl font-semibold">Instrument</h3>
      <Select
        onValueChange={(value) => changeInstrument(value as InstrumentName)}
        value={instrument}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select an instrument" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="guitar-acoustic">Acoustic Guitar</SelectItem>
          <SelectItem value="guitar-classical">Classical Guitar</SelectItem>
          <SelectItem value="guitar-12-string">12-String Guitar</SelectItem>
        </SelectContent>
      </Select>
    </Card>
  )
}
