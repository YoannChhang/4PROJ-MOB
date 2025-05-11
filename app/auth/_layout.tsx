/**
 * AuthLayout component for authentication-related screens (e.g. login, register).
 * Hides default headers and applies a consistent screen transition.
 */

import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide headers for login/register screens
        animation: "simple_push", // Apply a simple push animation between screens
      }}
    />
  );
}
