import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface FloatingSearchButtonProps {
  onPress: () => void;
  style?: object;
  visible: boolean;
}

const FloatingSearchButton: React.FC<FloatingSearchButtonProps> = ({ 
  onPress, 
  style,
  visible 
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  
  // Create spring animation for press
  const animatedScale = new Animated.Value(1);
  
  const handlePressIn = () => {
    Animated.spring(animatedScale, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 50,
      bounciness: 10,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(animatedScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 10,
    }).start();
  };
  
  if (!visible) return null;
  
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, style]}
    >
      <Animated.View
        style={[
          styles.button,
          { transform: [{ scale: animatedScale }] }
        ]}
      >
        <FontAwesome5
          name="search-location"
          size={22}
          color="#FFFFFF"
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    zIndex: 10,
  },
  button: {
    backgroundColor: '#4285F4',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default FloatingSearchButton;