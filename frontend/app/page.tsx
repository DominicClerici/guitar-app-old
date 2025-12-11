import { FretboardContextProvider } from "@/components/custom/fretboard/fretboard-context"
import FretboardMain from "@/components/custom/fretboard/fretboard-main"
import AuthTopBar from "./AuthTopBar"

export default function Home() {
  return (
    <FretboardContextProvider>
      <AuthTopBar />
      <FretboardMain />
    </FretboardContextProvider>
  )
}
