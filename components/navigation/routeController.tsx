import React, { useEffect, useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import useRoute from '@/hooks/useRoute';
import locationTracker from '@/utils/locationTracker';
import ttsManager from '@/utils/ttsManager';
import { Route } from '@/types/mapbox';
import NavigationCard from '@/components/mapbox/NavigationCard';
import NavigationControlCard from '@/components/mapbox/NavigationControlCard';

interface RouteControllerProps {
  origin: [number, number] | null;
  destination: [number, number] | null;
  selectedRoute: Route | null;
  alternateRoutes: Route[];
  isNavigating: boolean;
  onRouteUpdate: (selectedRoute: Route | null, alternateRoutes: Route[]) => void;
  onNavigationStateChange: (isNavigating: boolean) => void;
  children?: React.ReactNode;
}

/**
 * Component to manage routing and navigation features
 * This serves as a higher-level wrapper around the useRoute hook
 */
const RouteController: React.FC<RouteControllerProps> = ({
  origin,
  destination,
  selectedRoute: externalSelectedRoute,
  alternateRoutes: externalAlternateRoutes,
  isNavigating: externalIsNavigating,
  onRouteUpdate,
  onNavigationStateChange,
  children
}) => {
  // Use the route hook
  const {
    selectedRoute,
    alternateRoutes,
    loading,
    error,
    isNavigating,
    currentInstruction,
    distanceToNextManeuver,
    startNavigation,
    stopNavigation,
    chooseRoute
  } = useRoute(origin, destination);

  // Initialize TTS when the component mounts
  useEffect(() => {
    ttsManager.initialize().catch(err => {
      console.warn('Failed to initialize TTS:', err);
    });

    return () => {
      // Clean up resources when the component unmounts
      ttsManager.cleanup();
      locationTracker.cleanup();
    };
  }, []);

  // Sync external route state with internal state
  useEffect(() => {
    if (
      (selectedRoute !== externalSelectedRoute || 
       JSON.stringify(alternateRoutes) !== JSON.stringify(externalAlternateRoutes)) && 
      !loading
    ) {
      onRouteUpdate(selectedRoute, alternateRoutes);
    }
  }, [selectedRoute, alternateRoutes, loading, externalSelectedRoute, externalAlternateRoutes, onRouteUpdate]);

  // Sync navigation state with external state
  useEffect(() => {
    if (isNavigating !== externalIsNavigating) {
      onNavigationStateChange(isNavigating);
    }
  }, [isNavigating, externalIsNavigating, onNavigationStateChange]);

  // Handle starting navigation
  const handleStartNavigation = useCallback(() => {
    // Ask for background location permission on iOS
    if (Platform.OS === 'ios') {
      Location.requestBackgroundPermissionsAsync().then(({ status }) => {
        if (status !== 'granted') {
          Alert.alert(
            'Background Location Permission Required',
            'For turn-by-turn navigation, we need background location access. Please enable it in your settings.',
            [{ text: 'OK' }]
          );
        }
      });
    }
    
    // Start navigation
    startNavigation();
  }, [startNavigation]);

  // Handle stopping navigation
  const handleStopNavigation = useCallback(() => {
    stopNavigation();
  }, [stopNavigation]);

  // Handle route recalculation
  const handleRecalculateRoute = useCallback(() => {
    if (!isNavigating) return;
    
    // Stop navigation temporarily
    stopNavigation();
    
    // Announce rerouting
    ttsManager.speak('Recalcul d\'itinéraire en cours');
    
    // Wait a moment then restart navigation
    setTimeout(() => {
      startNavigation();
    }, 1000);
  }, [isNavigating, stopNavigation, startNavigation]);

  return (
    <>
      {children}
      
      {/* Navigation UI components */}
      {isNavigating && selectedRoute && (
        <>
          <NavigationCard
            route={selectedRoute}
            instruction={currentInstruction}
            distanceToNext={distanceToNextManeuver}
          />
          
          <NavigationControlCard
            route={selectedRoute}
            onCancelNavigation={handleStopNavigation}
            onRecalculateRoute={handleRecalculateRoute}
          />
        </>
      )}
    </>
  );
};

export default RouteController;