import { ScreenContainer } from "@/components/ScreenContainer"
import { useAuth } from "@/lib/auth/AuthContext"
import { trpc } from "@/lib/trpc/react"
import { signUpZod } from "@guitar/schemas"
import { useRouter } from "expo-router"
import { useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import Svg, { Path } from "react-native-svg"

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  )
}

export default function SignupScreen() {
  const router = useRouter()
  const { signInWithGoogle } = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({})

  const register = trpc.user.registerUser.useMutation({
    onSuccess: () => {
      Alert.alert("Success", "Account created successfully! Please log in.", [
        { text: "OK", onPress: () => router.push("/login") },
      ])
    },
    onError: (error) => {
      Alert.alert("Registration Error", error.message)
    },
  })

  const handleSignup = async () => {
    setErrors({})

    // Validate with Zod
    const result = signUpZod.safeParse({ name, email, password })
    if (!result.success) {
      const fieldErrors: { name?: string; email?: string; password?: string } = {}
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as "name" | "email" | "password"
        fieldErrors[field] = issue.message
      })
      setErrors(fieldErrors)
      return
    }

    register.mutate({ name, email, password })
  }

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder="John Doe"
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="email@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="********"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        <Text style={styles.hintText}>
          Password must be 8+ characters with uppercase, number, and special character
        </Text>
      </View>

      <Pressable
        style={[styles.button, register.isPending && styles.buttonDisabled]}
        onPress={handleSignup}
        disabled={register.isPending}
      >
        {register.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </Pressable>

      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.divider} />
      </View>

      <Pressable
        style={[styles.googleButton, isGoogleLoading && styles.buttonDisabled]}
        onPress={async () => {
          setIsGoogleLoading(true)
          const { error } = await signInWithGoogle()
          if (error) {
            Alert.alert("Google Sign In Error", error)
          }
          setIsGoogleLoading(false)
        }}
        disabled={isGoogleLoading}
      >
        {isGoogleLoading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <GoogleIcon />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </>
        )}
      </Pressable>

      <Pressable onPress={() => router.push("/login")} style={styles.linkButton}>
        <Text style={styles.linkText}>Already have an account? Log in</Text>
      </Pressable>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  hintText: {
    color: "#888",
    fontSize: 11,
    marginTop: 4,
  },
  button: {
    backgroundColor: "#000",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 20,
    alignItems: "center",
  },
  linkText: {
    color: "#666",
    fontSize: 14,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    marginHorizontal: 16,
    color: "#666",
    fontSize: 14,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    gap: 10,
  },
  googleButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "500",
  },
})
