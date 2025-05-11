/**
 * RootLayout is the main app layout.
 * It sets up theme providers, gesture handling, global context providers,
 * splash screen management, and screen stack configuration.
 */

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/useColorScheme";
import { PaperProvider } from "react-native-paper";
import { CustomDarkTheme, CustomLightTheme } from "@/constants/Themes";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { LocationProvider } from "@/providers/LocationProvider";
import { UserProvider } from "@/providers/UserProvider";
import { QRCodeProvider } from "@/providers/QRCodeProvider";
import { PinProvider } from "@/providers/PinProvider";

// Prevent splash screen from auto-hiding before fonts are loaded
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Load custom fonts
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Hide splash screen once fonts are loaded
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null; // Wait for font loading before rendering
  }

  return (
    <PaperProvider
      theme={colorScheme === "dark" ? CustomDarkTheme : CustomLightTheme}
    >
      <UserProvider>
        <QRCodeProvider>
          <LocationProvider>
            <PinProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <BottomSheetModalProvider>
                  <Stack>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="auth" options={{ headerShown: false }} />
                    <Stack.Screen name="+not-found" />
                    <Stack.Screen name="qr-scanner" options={{ headerShown: false }} />
                  </Stack>
                  <StatusBar style="auto" />
                </BottomSheetModalProvider>
              </GestureHandlerRootView>
            </PinProvider>
          </LocationProvider>
        </QRCodeProvider>
      </UserProvider>
    </PaperProvider>
  );
}
