// providers/PinProvider.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { fetchNearbyPins, createPin, deletePin } from '@/services/useService';
import { PinRead, PinType } from '@/types/api';

interface PinContextType {
  pins: PinRead[];
  loading: boolean;
  error: string | null;
  selectedPin: PinRead | null;
  radiusKm: number;
  fetchPins: (longitude: number, latitude: number) => Promise<void>;
  reportPin: (type: PinType, longitude: number, latitude: number, description?: string) => Promise<void>;
  removePin: (pinId: number) => Promise<void>;
  setSelectedPin: (pin: PinRead | null) => void;
  setRadiusKm: (radius: number) => void;
}

const PinContext = createContext<PinContextType | undefined>(undefined);

interface PinProviderProps {
  children: ReactNode;
  initialRadius?: number;
}

export const PinProvider: React.FC<PinProviderProps> = ({ 
  children, 
  initialRadius = 10 
}) => {
  const [pins, setPins] = useState<PinRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<PinRead | null>(null);
  const [radiusKm, setRadiusKm] = useState(initialRadius);

  const fetchPins = async (longitude: number, latitude: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchNearbyPins(longitude, latitude, radiusKm);
      if (response.data) {
        setPins(response.data);
      }
    } catch (err) {
      setError('Failed to fetch alert pins');
      console.error('Error fetching pins:', err);
    } finally {
      setLoading(false);
    }
  };

  const reportPin = async (type: PinType, longitude: number, latitude: number, description?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await createPin({
        type,
        longitude,
        latitude,
        description
      });
      
      if (response.data) {
        setPins(prev => [...prev, response.data]);
      }
    } catch (err) {
      setError('Failed to create pin');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const removePin = async (pinId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      await deletePin(pinId);
      setPins(prev => prev.filter(pin => pin.id !== pinId));
      if (selectedPin?.id === pinId) {
        setSelectedPin(null);
      }
    } catch (err) {
      setError('Failed to delete pin');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    pins,
    loading,
    error,
    selectedPin,
    radiusKm,
    fetchPins,
    reportPin,
    removePin,
    setSelectedPin,
    setRadiusKm,
  };

  return (
    <PinContext.Provider value={value}>
      {children}
    </PinContext.Provider>
  );
};

// Custom hook to use the pin context
export const usePins = () => {
  const context = useContext(PinContext);
  if (context === undefined) {
    throw new Error('usePins must be used within a PinProvider');
  }
  return context;
};