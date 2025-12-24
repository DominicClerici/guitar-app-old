import { Stack } from "expo-router"
import * as ScreenOrientation from "expo-screen-orientation"
import { GestureHandlerRootView } from "react-native-gesture-handler"

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
        screenListeners={{
          beforeRemove: async () => {
            // Reset to portrait when leaving any screen that might have changed orientation
            await ScreenOrientation.lockAsync(
              ScreenOrientation.OrientationLock.PORTRAIT_UP
            )
          },
        }}
      />
    </GestureHandlerRootView>
  )
}
