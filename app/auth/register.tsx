/**
 * RegisterScreen component for user account creation.
 * Displays a registration form and handles navigation to the login screen if needed.
 */

import React from "react";
import { View, StyleSheet, Text } from "react-native";
import RegisterForm from "@/components/auth/RegisterForm";
import { usePathname, useRouter } from "expo-router";

export default function RegisterScreen() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Créer un compte</Text> {/* Title for registration screen */}
      <RegisterForm
        toLogin={() => {
          // Prevent navigation if already on login screen
          if (pathname == "/auth") return;
          router.push("/auth"); // Navigate to login screen
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 64,
    backgroundColor: "#f9f9f9",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
});
