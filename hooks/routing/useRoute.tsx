// src/hooks/routing/useRoute.ts
import { useEffect, useCallback, useState, useMemo } from 'react';
import { useRouteCalculation } from './useRouteCalculation';
import { useRouteNavigation } from './useRouteNavigation';
import { useRouteRerouting } from './useRouteRerouting';
import { Route } from '@/types/mapbox';
import { Coordinate, RouteFeatures } from './utils/types';

/**
 * Main custom hook for routing functionality with enhanced features
 * @param origin Starting point [longitude, latitude]
 * @param destination Ending point [longitude, latitude]
 * @returns Combined routing state and functions
 */
export default function useRoute(
  origin: Coordinate | null,
  destination: Coordinate | null
) {
  // Update route excludes from user preferences
  const [routeExcludes, setRouteExcludes] = useState<string[] | undefined>(undefined);

  // Get route calculation state and functions
  const {
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading,
    error,
    routeFeatures,
    setRouteFeatures,
    chooseRoute,
    calculateRoutes
  } = useRouteCalculation(origin, destination, routeExcludes);

  // Setup rerouting with callbacks
  const handleRerouteSuccess = useCallback((newRoute: Route) => {
    setSelectedRoute(newRoute);
    setAlternateRoutes([]);
  }, [setSelectedRoute, setAlternateRoutes]);

  // Get rerouting state and functions
  const {
    isRerouting,
    handleReroute
  } = useRouteRerouting(destination, routeExcludes, {
    onRerouteSuccess: handleRerouteSuccess
  });

  // Handle off-route scenarios during navigation
  const handleOffRoute = useCallback((userLocation: Coordinate) => {
    if (speakInstruction) {
      handleReroute(userLocation, speakInstruction);
    }
  }, [handleReroute]);

  // Get navigation state and functions
  const {
    isNavigating,
    setIsNavigating,
    liveUserLocation,
    traveledCoords,
    currentInstruction,
    distanceToNextManeuver,
    currentStepIndex,
    startNavigation,
    stopNavigation,
    speakInstruction
  } = useRouteNavigation(selectedRoute, {
    onOffRoute: handleOffRoute
  });

  // Get specific route features
  const getRouteFeatures = useCallback((routeId: string): RouteFeatures | undefined => {
    return routeFeatures[routeId];
  }, [routeFeatures]);

  return {
    // Route state
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading,
    error,

    // Navigation state
    isNavigating,
    setIsNavigating,
    liveUserLocation,
    traveledCoords,
    currentInstruction,
    distanceToNextManeuver,

    // Route filtering
    routeExcludes,
    setRouteExcludes,

    // Route features
    routeFeatures,
    getRouteFeatures,

    // Rerouting state
    isRerouting,

    // Actions
    startNavigation,
    stopNavigation,
    chooseRoute,
    calculateRoutes  // Export the function to manually calculate routes
  };
}