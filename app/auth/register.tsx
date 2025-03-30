import React from "react";
import { View, StyleSheet, Text } from "react-native";
import RegisterForm from "@/components/auth/RegisterForm";
import { useRouter } from "expo-router";

export default function RegisterScreen() {

    const router = useRouter()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <RegisterForm toLogin={() => router.push("/auth")}/>
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
