import React, { createContext, useState, useContext } from 'react';

interface QRCodeData {
  toCoords: [number, number] | null;
  excludes?: string[];
  timestamp: number;
}

interface QRCodeContextType {
  qrData: QRCodeData | null;
  setQRData: (data: QRCodeData | null) => void;
}

const QRCodeContext = createContext<QRCodeContextType | undefined>(undefined);

export const QRCodeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [qrData, setQRData] = useState<QRCodeData | null>(null);

  return (
    <QRCodeContext.Provider value={{ qrData, setQRData }}>
      {children}
    </QRCodeContext.Provider>
  );
};

export const useQRCode = () => {
  const context = useContext(QRCodeContext);
  if (!context) {
    throw new Error('useQRCode must be used within a QRCodeProvider');
  }
  return context;
};