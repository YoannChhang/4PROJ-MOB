// Components/mapbox/PinWithCallout.tsx
import React, { useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { PointAnnotation } from '@rnmapbox/maps';
import AlertPin from '@/components/mapbox/AlertPin';
import AlertCallout from '@/components/mapbox/AlertCallout';
import { PinRead } from '@/types/api';

interface PinWithCalloutProps {
  pin: PinRead;
  onSelectPin: (pin: PinRead) => void;
  isSelected: boolean;
  onCalloutClose: () => void;
}

const ANIMATION_DURATION = 250;

const PinWithCallout: React.FC<PinWithCalloutProps> = ({ 
  pin, 
  onSelectPin,
  isSelected,
  onCalloutClose
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Animate callout when selection state changes
  React.useEffect(() => {
    if (isSelected) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }).start();
    }
  }, [isSelected, fadeAnim]);

  return (
    <>
      <PointAnnotation
        id={`alert-pin-${pin.id}`}
        coordinate={[pin.longitude, pin.latitude]}
        onSelected={() => {
          onSelectPin(pin);
          return true;
        }}
      >
        <AlertPin type={pin.type} />
      </PointAnnotation>
      
      {isSelected && (
        <PointAnnotation
          id={`callout-${pin.id}`}
          coordinate={[pin.longitude, pin.latitude]}
          anchor={{x: 0.5, y: 1.0}}
        >
          <Animated.View
            style={[
              styles.calloutContainer,
              {
                opacity: fadeAnim,
                transform: [{ 
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1]
                  }) 
                }],
              }
            ]}
            pointerEvents="box-none"
          >
            <AlertCallout 
              pin={pin} 
              onClose={onCalloutClose}
            />
          </Animated.View>
        </PointAnnotation>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  calloutContainer: {
    position: 'absolute',
    bottom: 45, // Distance above the pin location
    alignSelf: 'center',
    // No need for left adjustment as we're using anchor property
    width: 220,
    zIndex: 999,
  }
});

export default PinWithCallout;