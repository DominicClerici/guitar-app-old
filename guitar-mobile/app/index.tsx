import { theme } from "@/utils/theme"
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import { Link } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Guitar Tools</Text>
      <View style={styles.buttonsContainer}>
        <Link href="/note-trainer" asChild>
          <Pressable style={styles.button}>
            <View style={styles.buttonIcon}>
              <MaterialCommunityIcons
                name="guitar-pick-outline"
                size={24}
                color={theme.colors.primary}
              />
            </View>
            <View>
              <Text style={styles.buttonText}>Note Trainer</Text>
              <Text style={styles.buttonSubtext}>Practice your notes</Text>
            </View>
          </Pressable>
        </Link>
        <Link href="/scales" asChild>
          <Pressable style={styles.button}>
            <View style={styles.buttonIcon}>
              <Ionicons name="musical-notes" size={24} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={styles.buttonText}>Scales</Text>
              <Text style={styles.buttonSubtext}>Find and practice scales</Text>
            </View>
          </Pressable>
        </Link>
        <Link href="/arpeggio" asChild>
          <Pressable style={styles.button}>
            <View style={styles.buttonIcon}>
              <FontAwesome5 name="guitar" size={24} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={styles.buttonText}>Arpeggio</Text>
              <Text style={styles.buttonSubtext}>Practice your arpeggios</Text>
            </View>
          </Pressable>
        </Link>
        <Link href="/tuner" asChild>
          <Pressable style={styles.button}>
            <View style={styles.buttonIcon}>
              <FontAwesome5 name="wave-square" size={24} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={styles.buttonText}>Tuner</Text>
              <Text style={styles.buttonSubtext}>Tune your guitar</Text>
            </View>
          </Pressable>
        </Link>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingInline: "5%",
    paddingTop: "20%",
    paddingBottom: "5%",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 40,
    color: theme.colors.primary,
  },
  buttonsContainer: {
    gap: "5%",
    marginTop: "20%",
    width: "100%",
  },
  button: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.muted,
    paddingHorizontal: "2.5%",
    paddingVertical: "2.5%",
    gap: "2.5%",
    borderRadius: 8,
  },
  buttonIcon: {
    padding: "2%",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
  },
  buttonText: {
    color: theme.colors.foreground,
    fontSize: 18,
    fontWeight: "600",
  },
  buttonSubtext: {
    color: theme.colors.mutedForeground,
    fontSize: 12,
    fontWeight: "600",
  },
})
