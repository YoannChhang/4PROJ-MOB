// hooks/useAlertPins.tsx
import { useState, useEffect, useRef } from 'react';
import { usePins } from '@/providers/PinProvider';
import { useUser } from '@/providers/UserProvider';

// Minimum distance (in meters) the user needs to move before updating pins
const LOCATION_THRESHOLD = 200;
// Polling interval in milliseconds
const POLLING_INTERVAL = 30000; // 30 seconds

export default function useAlertPins(userLocation: { longitude: number; latitude: number } | null) {
  const { fetchPins, pins } = usePins();
  const { isSignedIn } = useUser(); // Add this to detect auth state changes
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
  
  // Function to load pins that can be called on auth change
  const loadPins = async () => {
    if (!userLocation) return;
    
    try {
      await fetchPins(userLocation.longitude, userLocation.latitude);
      lastFetchedLocation.current = { 
        longitude: userLocation.longitude, 
        latitude: userLocation.latitude 
      };
    } catch (error) {
      console.error('Failed to load pins:', error);
    }
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
  
  // Add effect to refresh pins when auth state changes
  useEffect(() => {
    // Only trigger refresh if user location is available
    if (userLocation) {
      console.log('Auth state changed, refreshing pins');
      loadPins();
    }
  }, [isSignedIn]); // This will trigger when login/logout occurs
  
  return { pins };
}