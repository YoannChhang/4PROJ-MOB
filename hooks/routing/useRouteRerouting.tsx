// src/hooks/routing/useRouteRerouting.ts
import { useState, useRef } from 'react';
import * as turf from '@turf/turf';
import { recalculateRoute } from './utils/mapboxApi';
import { initializeRouteFeatures } from './utils/routeAnalysis';
import { Route } from '@/types/mapbox';
import { Coordinate, RouteFeatures } from './utils/types';
import { RECALCULATION_DISTANCE_THRESHOLD, RECALCULATION_TIME_THRESHOLD } from './utils/constants';

interface UseRouteReroutingOptions {
  onRerouteStart?: () => void;
  onRerouteSuccess?: (newRoute: Route) => void;
  onRerouteError?: (error: Error) => void;
}

/**
 * Hook for handling rerouting logic when user goes off route
 * @param destination Destination coordinates
 * @param routeExcludes Array of route features to exclude (e.g., ["toll", "motorway"])
 * @param options Additional options
 * @returns Rerouting state and functions
 */
export const useRouteRerouting = (
  destination: Coordinate | null,
  routeExcludes: string[] | undefined,
  options: UseRouteReroutingOptions = {}
) => {
  const { onRerouteStart, onRerouteSuccess, onRerouteError } = options;
  
  const [isRerouting, setIsRerouting] = useState<boolean>(false);
  const lastRerouteLocation = useRef<Coordinate | null>(null);
  const lastRerouteTime = useRef<number>(0);

  /**
   * Check if we should recalculate the route
   * @param userLocation Current user location
   * @returns Boolean indicating if recalculation should occur
   */
  const checkShouldRecalculate = (userLocation: Coordinate): boolean => {
    const now = Date.now();

    // If we're already rerouting, wait until it's done
    if (isRerouting) return false;

    // Check if enough time has passed since last reroute
    const timeSinceLastReroute = now - lastRerouteTime.current;
    if (timeSinceLastReroute < RECALCULATION_TIME_THRESHOLD) return false;

    // Check if we've moved enough since last reroute
    if (lastRerouteLocation.current) {
      const distanceSinceLastReroute = turf.distance(
        turf.point(userLocation),
        turf.point(lastRerouteLocation.current),
        { units: "meters" }
      );

      if (distanceSinceLastReroute < RECALCULATION_DISTANCE_THRESHOLD) return false;
    }

    return true;
  };

  /**
   * Handle rerouting when user goes off course
   * @param userLocation Current user location
   * @param speakInstruction Function to speak instructions with TTS
   */
  const handleReroute = async (
    userLocation: Coordinate,
    speakInstruction: (instruction: string) => void
  ): Promise<Route | null> => {
    if (!destination) return null;

    // Check if we should recalculate
    if (!checkShouldRecalculate(userLocation)) return null;

    // Update rerouting state
    setIsRerouting(true);
    lastRerouteLocation.current = userLocation;
    lastRerouteTime.current = Date.now();

    // Notify listeners
    if (onRerouteStart) {
      onRerouteStart();
    }

    try {
      // Announce rerouting
      speakInstruction("Recalcul d'itinéraire en cours");

      // Get new route
      const response = await recalculateRoute(
        userLocation,
        destination,
        { excludes: routeExcludes }
      );

      if (response.routes.length > 0) {
        const newRoute = response.routes[0];

        // Notify listeners of success
        if (onRerouteSuccess) {
          onRerouteSuccess(newRoute);
        }

        return newRoute;
      }
      
      return null;
    } catch (error) {
      console.error("Error during rerouting:", error);
      
      // Notify listeners of error
      if (onRerouteError) {
        onRerouteError(error instanceof Error ? error : new Error(String(error)));
      }
      
      return null;
    } finally {
      setIsRerouting(false);
    }
  };

  return {
    isRerouting,
    checkShouldRecalculate,
    handleReroute,
    lastRerouteLocation: lastRerouteLocation.current,
    lastRerouteTime: lastRerouteTime.current
  };
};