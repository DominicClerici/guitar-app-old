import { FretboardContextProvider } from "@/components/custom/fretboard/fretboard-context"
import FretboardMain from "@/components/custom/fretboard/fretboard-main"
import TabPlayer from "@/components/custom/tabs/tab-player"
import AuthTopBar from "./AuthTopBar"
// force
export default function Home() {
  return (
    <FretboardContextProvider>
      <AuthTopBar />
      <FretboardMain />
      <TabPlayer />
    </FretboardContextProvider>
  )
}
