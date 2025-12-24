import { Link } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Guitar Tools</Text>
      <Link href="/note-trainer" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Note Trainer</Text>
        </Pressable>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 40,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
})
