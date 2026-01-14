import MainBottomBar from "@/components/navigation/main-bottom-bar"
import { ScreenContainer } from "@/components/ScreenContainer"
import { Slot } from "expo-router"

export default function BottomNavLayout() {
  return (
    <ScreenContainer>
      <Slot />
      <MainBottomBar />
    </ScreenContainer>
  )
}
