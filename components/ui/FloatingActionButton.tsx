// components/ui/FloatingActionButton.tsx
import React from 'react';
import { TouchableOpacity, StyleSheet, Animated, ViewStyle } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export interface FloatingActionButtonProps {
  id?: string;
  iconName: string;
  onPress: () => void;
  style?: ViewStyle;
  backgroundColor?: string;
  size?: 'small' | 'medium' | 'large';
  visible?: boolean;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ 
  id,
  iconName,
  onPress, 
  style,
  backgroundColor,
  size = 'medium',
  visible = true
}) => {
  const colorScheme = useColorScheme() ?? 'light';
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

  // Determine size dimensions
  const dimensions = {
    small: { button: 40, icon: 16 },
    medium: { button: 50, icon: 20 },
    large: { button: 60, icon: 24 }
  }[size];
  
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
          { 
            transform: [{ scale: animatedScale }],
            backgroundColor: backgroundColor || Colors[colorScheme].tint,
            width: dimensions.button,
            height: dimensions.button,
            borderRadius: dimensions.button / 2
          }
        ]}
      >
        <FontAwesome5
          name={iconName}
          size={dimensions.icon}
          color="#FFFFFF"
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 10,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default FloatingActionButton;