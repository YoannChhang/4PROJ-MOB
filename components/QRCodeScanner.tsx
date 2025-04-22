import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface QRCodeScannerProps {
  onCodeScanned: (data: string) => void;
  onCancel: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onCodeScanned, onCancel }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    // Only handle URLs that match our expected format and contain required parameters
    if (data.startsWith('https://mayz.com/route?') && 
        data.includes('to=')) {
      console.log('Valid QR code format detected:', data);
      onCodeScanned(data);
    } else {
      console.log('Invalid QR code format:', data);
      // Show a message that this QR code isn't valid (could be added in UI)
      // If it's not a valid URL, reset the scanner to try again
      setTimeout(() => {
        setScanned(false);
      }, 2000);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
        <TouchableOpacity style={styles.button} onPress={onCancel}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={styles.overlay}>
        <View style={styles.scanner}>
          <View style={styles.scannerCorner1} />
          <View style={styles.scannerCorner2} />
          <View style={styles.scannerCorner3} />
          <View style={styles.scannerCorner4} />
        </View>
      </View>
      
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <FontAwesome5 name="times" size={20} color="#fff" />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
      
      {scanned && (
        <View style={styles.scanningOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.scanningText}>Processing QR code...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanner: {
    width: 250,
    height: 250,
    borderRadius: 20,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  scannerCorner1: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#ffffff',
    borderTopLeftRadius: 20,
  },
  scannerCorner2: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#ffffff',
    borderTopRightRadius: 20,
  },
  scannerCorner3: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#ffffff',
    borderBottomLeftRadius: 20,
  },
  scannerCorner4: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#ffffff',
    borderBottomRightRadius: 20,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    gap: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  text: {
    fontSize: 16,
    margin: 20,
    textAlign: 'center',
    color: '#fff',
  },
  button: {
    backgroundColor: '#4285F4',
    padding: 15,
    borderRadius: 8,
    margin: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 15,
  },
});

export default QRCodeScanner;