import * as ScreenOrientation from "expo-screen-orientation"
import { useEffect, useState } from "react"

/**
 * Hook for managing landscape orientation in fretboard screens.
 * Tracks whether device is in landscape and if user has ever entered landscape mode.
 */
export function useLandscapeOrientation() {
  const [isLandscape, setIsLandscape] = useState(false)
  const [hasEnteredLandscape, setHasEnteredLandscape] = useState(false)

  useEffect(() => {
    let subscription: ScreenOrientation.Subscription | null = null

    const setup = async () => {
      const orientation = await ScreenOrientation.getOrientationAsync()
      const landscape =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
      setIsLandscape(landscape)
      if (landscape) setHasEnteredLandscape(true)

      subscription = ScreenOrientation.addOrientationChangeListener((event) => {
        const newLandscape =
          event.orientationInfo.orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          event.orientationInfo.orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
        setIsLandscape(newLandscape)
        if (newLandscape) setHasEnteredLandscape(true)
      })
    }

    setup()

    return () => {
      if (subscription) ScreenOrientation.removeOrientationChangeListener(subscription)
    }
  }, [])

  const rotateToLandscape = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT)
    setHasEnteredLandscape(true)
  }

  const rotateToPortrait = () =>
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)

  return {
    isLandscape,
    hasEnteredLandscape,
    showRotatePrompt: !isLandscape && !hasEnteredLandscape,
    rotateToLandscape,
    rotateToPortrait,
  }
}
