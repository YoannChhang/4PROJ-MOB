// hooks/useAlertPins.tsx
import { useState, useEffect, useRef } from 'react';
import { usePins } from '@/providers/PinProvider';

// Minimum distance (in meters) the user needs to move before updating pins
const LOCATION_THRESHOLD = 200;
// Polling interval in milliseconds
const POLLING_INTERVAL = 30000; // 30 seconds

export default function useAlertPins(userLocation: { longitude: number; latitude: number } | null) {
  const { fetchPins, pins } = usePins();
  const lastFetchedLocation = useRef<{ longitude: number; latitude: number } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Calculate distance between coordinates (Haversine formula)
  const getDistanceInMeters = (
    lat1: number, lon1: number, 
    lat2: number, lon2: number
  ) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Fetch pins when location changes significantly
  useEffect(() => {
    if (!userLocation) return;
    
    const { longitude, latitude } = userLocation;
    
    // Skip if we haven't moved enough since last fetch
    if (lastFetchedLocation.current) {
      const { longitude: lastLong, latitude: lastLat } = lastFetchedLocation.current;
      const distance = getDistanceInMeters(
        latitude, longitude, 
        lastLat, lastLong
      );
      
      if (distance < LOCATION_THRESHOLD) return;
    }
    
    const loadPins = async () => {
      try {
        await fetchPins(longitude, latitude);
        lastFetchedLocation.current = { longitude, latitude };
      } catch (error) {
        console.error('Failed to load pins:', error);
      }
    };
    
    loadPins();
    
    // Clear previous interval if it exists
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Set up polling interval
    intervalRef.current = setInterval(loadPins, POLLING_INTERVAL);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userLocation, fetchPins]);
  
  return { pins };
}