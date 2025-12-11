import { FretboardContextProvider } from "@/components/custom/fretboard/fretboard-context"
import FretboardMain from "@/components/custom/fretboard/fretboard-main"

export default function Home() {
  return (
    <FretboardContextProvider>
      <FretboardMain />
    </FretboardContextProvider>
  )
}
