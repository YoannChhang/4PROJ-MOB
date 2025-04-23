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

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });


  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <PaperProvider
      theme={colorScheme === "dark" ? CustomDarkTheme : CustomLightTheme}
    >
      <UserProvider>
        <QRCodeProvider>
          <LocationProvider>
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
          </LocationProvider>
        </QRCodeProvider>
      </UserProvider>
    </PaperProvider>
  );
}
