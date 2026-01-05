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

export default function SignupScreen() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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
    <View style={styles.container}>
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

      <Pressable onPress={() => router.push("/login")} style={styles.linkButton}>
        <Text style={styles.linkText}>Already have an account? Log in</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
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
})
