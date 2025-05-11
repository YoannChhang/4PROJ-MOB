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

    // Parse the URL from the QR code
    const parsedRoute = parseRouteUrl(data);

    if (parsedRoute.isValid && parsedRoute.toCoords) {
      console.log("Valid route found with parameters:", {
        to: parsedRoute.toCoords,
        excludes: parsedRoute.excludes,
      });

      // Store the data in context instead of URL params
      setQRData({
        toCoords: parsedRoute.toCoords,
        excludes: parsedRoute.excludes,
        timestamp: Date.now(),
      });

      // Simply go back without params
      router.back();
    } else {
      // Show an alert for invalid QR codes
      Alert.alert(
        "Code QR invalide",
        "Le code QR scanné ne contient pas d'informations de navigation valides.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    }
  };

  const handleCancel = () => {
    router.back();
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
