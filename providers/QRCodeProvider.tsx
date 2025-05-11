/**
 * QRCodeProvider manages a temporary routing payload decoded from a scanned QR code.
 * This includes destination coordinates, optional routing exclusions, and a timestamp.
 */

import React, { createContext, useState, useContext } from 'react';

/**
 * Data structure for storing route information parsed from a QR code.
 */
interface QRCodeData {
  toCoords: [number, number] | null;
  excludes?: string[]; // Optional list of avoidances (e.g. tolls, highways)
  timestamp: number;   // Used to handle expiration or uniqueness
}

interface QRCodeContextType {
  qrData: QRCodeData | null;
  setQRData: (data: QRCodeData | null) => void;
}

const QRCodeContext = createContext<QRCodeContextType | undefined>(undefined);

/**
 * Provides a simple context to temporarily hold QR-based routing data.
 */
export const QRCodeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [qrData, setQRData] = useState<QRCodeData | null>(null);

  return (
    <QRCodeContext.Provider value={{ qrData, setQRData }}>
      {children}
    </QRCodeContext.Provider>
  );
};

/**
 * Hook to access QRCodeContext.
 * Throws if used outside a QRCodeProvider.
 */
export const useQRCode = () => {
  const context = useContext(QRCodeContext);
  if (!context) {
    throw new Error('useQRCode must be used within a QRCodeProvider');
  }
  return context;
};
