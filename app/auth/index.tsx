/**
 * LoginScreen component for user authentication.
 * Displays a login form and handles navigation to the registration screen if needed.
 */

import React from "react";
import { View, StyleSheet, Text } from "react-native";
import LoginForm from "@/components/auth/LoginForm";
import { usePathname, useRouter } from "expo-router";

export default function LoginScreen() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connectez-vous à votre compte</Text> {/* Title for login screen */}
      <LoginForm
        toRegister={() => {
          // Prevent unnecessary navigation if already on the register page
          if (pathname == "/auth/register") return;
          router.push("/auth/register"); // Navigate to register screen
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
