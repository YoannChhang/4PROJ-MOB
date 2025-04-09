import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide headers for login/register
        animation: "simple_push",  // Optional: smooth screen transitions
      }}
    />
  );
}
