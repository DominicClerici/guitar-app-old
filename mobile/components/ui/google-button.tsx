import { supabase } from "@/lib/supabase"
import {
  GoogleSignin,
  GoogleSigninButton,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin"
import React from "react"

export default function GoogleButton() {
  GoogleSignin.configure({
    webClientId: "469930296450-agkufhomqi85c0ol8fnjjh3s32inj57i.apps.googleusercontent.com",
    iosClientId: "469930296450-agkufhomqi85c0ol8fnjjh3s32inj57i.apps.googleusercontent.com",
  })

  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices()
      const response = await GoogleSignin.signIn()
      if (isSuccessResponse(response)) {
        if (!response.data.idToken) throw new Error("No ID token")
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.data.idToken,
        })
        if (error) throw error
      }
    } catch (error) {
      console.error(error)
    }
  }
  return (
    <GoogleSigninButton
      size={GoogleSigninButton.Size.Wide}
      color={GoogleSigninButton.Color.Dark}
      onPress={signInWithGoogle}
    />
  )
}
