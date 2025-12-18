import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import InputWithTicker from "@/components/ui/input-with-ticker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDownIcon, PauseIcon, PlayIcon, SquareIcon } from "lucide-react"
import { useState } from "react"
import InstrumentSelector from "../controls/instrument-selector"
import useTabContext from "../tab-context-main"
import ChordLineEditor from "./chord-line-editor"
import ChordTimingDialog from "./chord-timing-editor/chord-timing-dialog"

export default function MusicLineEditor() {
  const [musicLine, setMusicLine] = useState("chord-1")
  const { bpm, setBpm, isPlaying, startPlayback, stopPlayback } = useTabContext()
  return (
    <Card>
      <div className="flex items-start justify-between">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-fit">
              {musicLine}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <div>
              <Button
                variant={musicLine === "chord-1" ? "default" : "outline"}
                onClick={() => setMusicLine("chord-1")}
              >
                Chord Line 1
              </Button>
              <Button
                variant={musicLine === "bass-1" ? "default" : "outline"}
                onClick={() => setMusicLine("bass-1")}
              >
                Bass Line 1
              </Button>
              <Button
                variant={musicLine === "drum-1" ? "default" : "outline"}
                onClick={() => setMusicLine("drum-1")}
              >
                Drum Line 1
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-2">
          {musicLine === "chord-1" && <ChordTimingDialog />}
          <div className="bg-border h-6 w-px" />
          <InstrumentSelector selectedCategory={musicLine} />
          <div className="bg-border h-6 w-px" />
          <InputWithTicker
            className="w-16"
            value={bpm}
            onValueChange={setBpm}
            step={5}
            min={30}
            max={240}
          />
          <div className="bg-border h-6 w-px" />
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (isPlaying) {
                stopPlayback()
              } else {
                startPlayback()
              }
            }}
          >
            {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={stopPlayback} disabled={!isPlaying}>
            <SquareIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {musicLine === "chord-1" && <ChordLineEditor />}
    </Card>
  )
}
