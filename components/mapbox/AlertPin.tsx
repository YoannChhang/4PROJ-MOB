// components/mapbox/AlertPin.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { PinType } from '@/types/api';

interface AlertPinProps {
  type: PinType;
}

const PIN_SIZE = 36;

// Map pin types to their corresponding icons and colors
const PIN_CONFIG: Record<PinType, { icon: string; color: string }> = {
  obstacle: { icon: 'exclamation-triangle', color: '#FFA500' },
  traffic_jam: { icon: 'car', color: '#FF0000' },
  cop: { icon: 'shield-alt', color: '#0000FF' },
  accident: { icon: 'car-crash', color: '#FF0000' },
  roadwork: { icon: 'hard-hat', color: '#FF8C00' },
};

const AlertPin: React.FC<AlertPinProps> = ({ type }) => {
  const config = PIN_CONFIG[type];
  
  return (
    <View style={styles.container}>
      <View style={[styles.pin, { backgroundColor: config.color }]}>
        <FontAwesome5 
          name={config.icon} 
          size={18} 
          color="white" 
        />
      </View>
      <View style={[styles.pinArrow, { borderTopColor: config.color }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  pin: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'red',
    alignSelf: 'center',
    marginTop: -2,
  },
});

export default AlertPin;