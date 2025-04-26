// components/mapbox/AlertPin.tsx
import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { PinType } from '@/types/api';

interface AlertPinProps {
  type: PinType;
}

const PIN_SIZE = 50; // You might want to adjust this based on your images

// Map pin types to their corresponding image paths
const PIN_IMAGES: Record<PinType, any> = {
  obstacle: require('@/assets/images/pins/obstacle.png'),
  traffic_jam: require('@/assets/images/pins/traffic_jam.png'),
  cop: require('@/assets/images/pins/cop.png'),
  accident: require('@/assets/images/pins/accident.png'),
  roadwork: require('@/assets/images/pins/roadwork.png'),
};

const AlertPin: React.FC<AlertPinProps> = ({ type }) => {
  return (
    <View style={[styles.container]}>
      <Image
        source={PIN_IMAGES[type]}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  image: {
    width: PIN_SIZE,
    height: PIN_SIZE,
  },
  shadowContainer: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  }
});

export default AlertPin;