// components/settings/SettingsButton.tsx
import React from 'react';
import FloatingActionButton from '@/components/ui/FloatingActionButton';

interface SettingsButtonProps {
  id?: string;
  onPress: () => void;
  style?: object;
  visible?: boolean;
}

const SettingsButton: React.FC<SettingsButtonProps> = ({ 
  id = 'settings',
  onPress, 
  style, 
  visible = true 
}) => {
  return (
    <FloatingActionButton
      id={id}
      iconName="cog"
      onPress={onPress}
      style={style}
      backgroundColor="rgba(0, 0, 0, 0.6)"
      size="medium"
      visible={visible}
    />
  );
};

export default SettingsButton;