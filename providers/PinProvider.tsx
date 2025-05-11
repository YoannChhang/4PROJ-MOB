/**
 * PinProvider manages alert pins reported by users (e.g. obstacles, accidents).
 * Provides functions to fetch nearby pins, report new ones, and remove existing ones.
 * It also exposes state such as the selected pin, loading/error status, and search radius.
 */

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { fetchNearbyPins, createPin, deletePin } from '@/services/useService';
import { PinRead, PinType } from '@/types/api';

/**
 * Context type defining exposed state and actions related to pins.
 */
interface PinContextType {
  pins: PinRead[];
  loading: boolean;
  error: string | null;
  selectedPin: PinRead | null;
  radiusKm: number;
  fetchPins: (longitude: number, latitude: number) => Promise<void>;
  reportPin: (type: PinType, longitude: number, latitude: number, description?: string) => Promise<void>;
  removePin: (pinId: string) => Promise<void>;
  setSelectedPin: (pin: PinRead | null) => void;
  setRadiusKm: (radius: number) => void;
}

const PinContext = createContext<PinContextType | undefined>(undefined);

interface PinProviderProps {
  children: ReactNode;
  initialRadius?: number;
}

/**
 * Provides alert pin data and actions to its descendants.
 * Automatically handles loading state and error reporting.
 */
export const PinProvider: React.FC<PinProviderProps> = ({ 
  children, 
  initialRadius = 10 
}) => {
  const [pins, setPins] = useState<PinRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<PinRead | null>(null);
  const [radiusKm, setRadiusKm] = useState(initialRadius);

  /**
   * Fetches all pins near a given coordinate, within the configured radius.
   */
  const fetchPins = async (longitude: number, latitude: number) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching pins at:', { longitude, latitude, radiusKm });
      const response = await fetchNearbyPins(longitude, latitude, radiusKm);
      if (response.data) {
        console.log(`Fetched ${response.data.length} pins from API`);
        setPins(response.data);
      }
    } catch (err) {
      setError('Failed to fetch alert pins');
      console.error('Error fetching pins:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reports a new pin of a given type and location to the backend.
   * Updates local state immediately if successful.
   */
  const reportPin = async (
    type: PinType,
    longitude: number,
    latitude: number,
    description?: string
  ) => {
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

  /**
   * Deletes a pin by ID, and clears selection if the deleted pin was selected.
   */
  const removePin = async (pinId: string) => {
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

/**
 * Hook to consume the PinContext.
 * Throws an error if used outside of a PinProvider.
 */
export const usePins = () => {
  const context = useContext(PinContext);
  if (context === undefined) {
    throw new Error('usePins must be used within a PinProvider');
  }
  return context;
};
