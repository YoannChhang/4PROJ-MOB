/**
 * NotFoundScreen is shown when the user navigates to a route that doesn't exist.
 * Displays a friendly message and a link back to the home screen.
 */

import { Link, Stack } from "expo-router";
import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/ui/ThemedText";
import { ThemedView } from "@/components/ui/ThemedView";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oups !" }} /> {/* Set screen title */}
      <ThemedView style={styles.container}>
        <ThemedText type="title">Cet écran n'existe pas.</ThemedText> {/* Message for unknown route */}
        <Link href="/" style={styles.link}>
          <ThemedText type="link">Aller à l'écran d'accueil !</ThemedText> {/* Navigation link to home */}
        </Link>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
