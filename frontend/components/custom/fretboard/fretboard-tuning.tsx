import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { applyTuningToNoteCharacter } from "@/lib/midi-utils"
import useFretboardContext, { Tuning } from "./fretboard-context"

const TUNING_NOTES = ["E", "A", "D", "G", "B", "E"]

export default function FretboardTuning() {
  const { tuning, setTuning } = useFretboardContext()
  const tunedNotes = TUNING_NOTES.map((note, index) =>
    applyTuningToNoteCharacter(note, tuning[index]),
  )
  return (
    <Card>
      <h3 className="mb-2 text-xl font-semibold">Tuning</h3>
      <div className="flex items-center gap-1">
        {tuning.map((note, index) => (
          <div key={`tuning-${index}`} className="flex flex-col items-center">
            <div className="flex flex-col items-center">
              <Input
                className="h-7 w-12 rounded-b-none p-0 text-center font-mono text-base!"
                type="number"
                value={note}
                step={0.5}
                min={-3}
                max={3}
                onChange={(e) =>
                  setTuning((prev) => {
                    const newTuning = [...prev] as Tuning
                    newTuning[index] = parseFloat(e.target.value) || 0
                    return newTuning
                  })
                }
              />
              <div className="grid grid-cols-2 grid-rows-1 items-stretch justify-stretch">
                <button
                  disabled={note >= 3}
                  onClick={() =>
                    setTuning((prev) => {
                      const newTuning = [...prev] as Tuning
                      newTuning[index] = newTuning[index] + 0.5
                      return newTuning
                    })
                  }
                  className="hover:bg-accent h-5 w-6 rounded-bl-sm border border-t-0 border-r-0 text-center leading-0 not-disabled:cursor-pointer"
                >
                  +
                </button>
                <button
                  disabled={note <= -3}
                  onClick={() =>
                    setTuning((prev) => {
                      const newTuning = [...prev] as Tuning
                      newTuning[index] = newTuning[index] - 0.5
                      return newTuning
                    })
                  }
                  className="hover:bg-accent h-5 w-6 rounded-br-sm border border-t-0 border-l-0 text-center leading-0 not-disabled:cursor-pointer"
                >
                  -
                </button>
              </div>
            </div>
            <span className="text-muted-foreground text-sm">
              {tunedNotes[index] === "E" && index === 5 ? "e" : tunedNotes[index]}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
