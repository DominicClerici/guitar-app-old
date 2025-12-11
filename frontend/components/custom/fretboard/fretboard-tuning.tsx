import { Card } from "@/components/ui/card"
import useFretboardContext, { Tuning } from "./fretboard-context"
import { Input } from "@/components/ui/input"
import { applyTuningToNoteCharacter } from "@/lib/midi-utils"

const TUNING_NOTES = ["E", "A", "D", "G", "B", "E"]

export default function FretboardTuning() {
  const { tuning, setTuning } = useFretboardContext()
  const tunedNotes = TUNING_NOTES.map((note, index) =>
    applyTuningToNoteCharacter(note, tuning[index])
  )
  return (
    <Card>
      <h3 className="font-semibold text-xl mb-2">Tuning</h3>
      <div className="flex items-center gap-1">
        {tuning.map((note, index) => (
          <div key={`tuning-${index}`} className="flex items-center flex-col">
            <div className="flex flex-col items-center">
              <Input
                className="w-12 h-7 p-0 text-center text-base! font-mono rounded-b-none"
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
                  className="text-center leading-0 border-r-0 border border-t-0 h-5 w-6 rounded-bl-sm hover:bg-accent not-disabled:cursor-pointer"
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
                  className="text-center leading-0 border-l-0 border-t-0 border h-5 w-6 rounded-br-sm hover:bg-accent not-disabled:cursor-pointer"
                >
                  -
                </button>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              {tunedNotes[index] === "E" && index === 5
                ? "e"
                : tunedNotes[index]}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
