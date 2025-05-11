/**
 * QRScannerScreen allows users to scan a QR code that encodes a route.
 * If valid, route data is parsed and stored in context, and the screen exits.
 * Otherwise, an error is shown and the user is returned.
 */

import React from "react";
import { StyleSheet, View, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import QRCodeScanner from "@/components/QRCodeScanner";
import { parseRouteUrl } from "@/utils/routeUrlParser";
import { useQRCode } from "@/providers/QRCodeProvider";

export default function QRScannerScreen() {
  const router = useRouter();
  const { setQRData } = useQRCode();

  const handleCodeScanned = (data: string) => {
    console.log("QR code scanned:", data);

    // Attempt to extract route data from scanned QR content
    const parsedRoute = parseRouteUrl(data);

    if (parsedRoute.isValid && parsedRoute.toCoords) {
      console.log("Valid route found with parameters:", {
        to: parsedRoute.toCoords,
        excludes: parsedRoute.excludes,
      });

      // Save route data in global context for use in main map screen
      setQRData({
        toCoords: parsedRoute.toCoords,
        excludes: parsedRoute.excludes,
        timestamp: Date.now(),
      });

      router.back(); // Return to previous screen (map)
    } else {
      Alert.alert(
        "Code QR invalide",
        "Le code QR scanné ne contient pas d'informations de navigation valides.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    }
  };

  const handleCancel = () => {
    router.back(); // User opted to cancel scanning
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: "slide_from_bottom",
        }}
      />
      <QRCodeScanner
        onCodeScanned={handleCodeScanned}
        onCancel={handleCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
