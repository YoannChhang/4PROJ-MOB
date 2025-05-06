// components/mapbox/QRScanButton.tsx
import React from 'react';
import FloatingActionButton from '@/components/ui/FloatingActionButton';

interface QRScanButtonProps {
  id?: string;
  onPress: () => void;
  style?: object;
  visible?: boolean;
}

const QRScanButton: React.FC<QRScanButtonProps> = ({ 
  id = 'qr-scan',
  onPress, 
  style,
  visible = true 
}) => {
  return (
    <FloatingActionButton
      id={id}
      iconName="qrcode"
      onPress={onPress}
      style={style}
      backgroundColor="rgba(0, 0, 0, 0.6)"
      size="medium"
      visible={visible}
    />
  );
};

export default QRScanButton;