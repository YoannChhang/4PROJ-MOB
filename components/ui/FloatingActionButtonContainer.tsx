// components/ui/FloatingActionButtonContainer.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

export type UIMode = 'map' | 'search' | 'route-selection' | 'navigation';

export interface ButtonPosition {
  bottom: number;
  right?: number;
  left?: number;
}

export interface ButtonConfig {
  id: string;
  visible: Record<UIMode, boolean>;
  order: number;
}

export interface FloatingActionButtonContainerProps {
  children: React.ReactNode;
  uiMode: UIMode;
  position?: 'bottomRight' | 'bottomLeft';
  spacing?: number;
  buttonConfigs?: Record<string, ButtonConfig>;
}

// Constants for positioning
const BASE_POSITIONS = {
  bottomRight: { 
    map: { bottom: 20, right: 20 },
    search: { bottom: 20, right: 20 },
    'route-selection': { bottom: 20, right: 20 },
    navigation: { bottom: 100, right: 20 }
  },
  bottomLeft: {
    map: { bottom: 20, left: 20 },
    search: { bottom: 20, left: 20 },
    'route-selection': { bottom: 20, left: 20 },
    navigation: { bottom: 100, left: 20 }
  }
};

// Default button configurations
const DEFAULT_BUTTON_CONFIGS: Record<string, ButtonConfig> = {
  'qr-scan': {
    id: 'qr-scan',
    visible: { 
      map: true, 
      search: true, 
      'route-selection': true, 
      navigation: true 
    },
    order: 0
  },
  'settings': {
    id: 'settings',
    visible: { 
      map: true, 
      search: true, 
      'route-selection': true, 
      navigation: true 
    },
    order: 1
  },
  'report-alert': {
    id: 'report-alert',
    visible: { 
      map: true, 
      search: false, 
      'route-selection': false, 
      navigation: false 
    },
    order: 2
  }
};

const FloatingActionButtonContainer: React.FC<FloatingActionButtonContainerProps> = ({
  children,
  uiMode,
  position = 'bottomRight',
  spacing = 16,
  buttonConfigs = DEFAULT_BUTTON_CONFIGS
}) => {
  // Get base position based on UI mode and position preference
  const basePosition = BASE_POSITIONS[position][uiMode];
  
  // Filter and sort buttons based on configuration
  const buttonsWithProps = React.Children.toArray(children)
    .filter(child => {
      if (React.isValidElement(child) && child.props.id) {
        const config = buttonConfigs[child.props.id];
        return config && config.visible[uiMode];
      }
      return true; // Keep elements without IDs
    })
    .sort((a, b) => {
      if (React.isValidElement(a) && React.isValidElement(b) && 
          a.props.id && b.props.id) {
        const configA = buttonConfigs[a.props.id];
        const configB = buttonConfigs[b.props.id];
        return (configA?.order || 0) - (configB?.order || 0);
      }
      return 0;
    })
    .map((child, index) => {
      if (React.isValidElement(child)) {
        const buttonSize = child.props.size === 'large' ? 60 : 
                         child.props.size === 'small' ? 40 : 50;
        
        // Calculate position based on index (after filtering and sorting)
        const buttonPosition: ButtonPosition = { 
          ...basePosition,
          bottom: basePosition.bottom + (index * (spacing + buttonSize))
        };
        
        return React.cloneElement(child, {
          style: buttonPosition,
          visible: true // We've already filtered visibility
        });
      }
      return child;
    });
  
  return (
    <View style={styles.container}>
      {buttonsWithProps}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
});

export default FloatingActionButtonContainer;