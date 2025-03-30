import React from "react";
import { View, StyleSheet, Text } from "react-native";
import LoginForm from "@/components/auth/LoginForm";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in to your accout</Text>
      <LoginForm toRegister={() => router.push("/auth/register")} />
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
