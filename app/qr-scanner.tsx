import React from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import QRCodeScanner from '@/components/QRCodeScanner';
import { parseRouteUrl } from '@/utils/routeUrlParser';

export default function QRScannerScreen() {
  const router = useRouter();

  const handleCodeScanned = (data: string) => {
    console.log('QR code scanned:', data);
    
    // Parse the URL from the QR code
    const parsedRoute = parseRouteUrl(data);
    
    if (parsedRoute.isValid && parsedRoute.fromCoords && parsedRoute.toCoords) {
      console.log('Valid route found with parameters:', {
        from: parsedRoute.fromCoords,
        to: parsedRoute.toCoords,
        excludes: parsedRoute.excludes
      });
      
      // Create the route params
      const routeParams = {
        fromLng: parsedRoute.fromCoords[0],
        fromLat: parsedRoute.fromCoords[1],
        toLng: parsedRoute.toCoords[0],
        toLat: parsedRoute.toCoords[1],
        excludes: parsedRoute.excludes ? parsedRoute.excludes.join(',') : undefined,
        qrScanned: 'true' // Flag to indicate this came from QR scan
      };
      
      // Set parameters and go back instead of pushing a new screen
      router.setParams(routeParams as any);
      router.back();
    } else {
      // Show an alert for invalid QR codes
      Alert.alert(
        "Invalid QR Code",
        "The scanned QR code doesn't contain valid navigation information.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        headerShown: false,
        animation: 'slide_from_bottom'
      }} />
      
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
    backgroundColor: '#000',
  },
});