// hooks/routing/useRoute.tsx
import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { useRouteCalculation } from "./useRouteCalculation";
import { useRouteNavigation } from "./useRouteNavigation";
import { useRouteRerouting } from "./useRouteRerouting";
import { Route } from "@/types/mapbox";
import { Coordinate, RouteFeatures } from "./utils/types";
import { fetchRoute } from "./utils/mapboxApi";
import ttsManager from "@/utils/ttsManager"; // Import ttsManager for speaking

const ROUTE_API_REFRESH_INTERVAL = 60 * 1000; // 1 minute

export default function useRoute(
  initialOrigin: Coordinate | null,
  destination: Coordinate | null
) {
  const [routeExcludes, setRouteExcludes] = useState<string[] | undefined>(undefined);

  const {
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading: calculationLoading, // Renamed to avoid conflict
    error: calculationError,     // Renamed
    routeFeatures,
    // setRouteFeatures, // Not directly set from here
    chooseRoute,
    calculateRoutes,
  } = useRouteCalculation(initialOrigin, destination, routeExcludes);

  const handleRerouteSuccess = useCallback((newRoute: Route) => {
    setSelectedRoute(newRoute);
    setAlternateRoutes([]); // Rerouting typically provides only one best route
    // Optionally, announce that route has been recalculated
    ttsManager.speak("Nouvel itinéraire calculé.");
  }, [setSelectedRoute, setAlternateRoutes]);

  const {
    isRerouting,
    handleReroute, // This is the function to call for rerouting
  } = useRouteRerouting(destination, routeExcludes, {
    onRerouteSuccess: handleRerouteSuccess,
    onRerouteError: (err) => {
      console.error("Reroute failed:", err);
      ttsManager.speak("Impossible de recalculer l'itinéraire.");
    },
  });

  // This is the callback passed to useRouteNavigation
  const handleOffRouteCallback = useCallback((userLocation: Coordinate) => {
    if (destination) { // Ensure destination is still valid
      handleReroute(userLocation, ttsManager.speak); // Pass speak function from ttsManager
    }
  }, [destination, handleReroute]); // Removed speakInstruction from deps as it's stable from ttsManager


  const {
    isNavigating,
    setIsNavigating,
    liveUserLocation,
    traveledCoords,
    displayedInstruction,
    distanceToNextManeuver,
    startNavigation: startRouteNavigation,
    stopNavigation: stopRouteNavigation,
    updateNavigationMetrics,
    remainingDistance,
    remainingDuration,
    estimatedArrival,
  } = useRouteNavigation(selectedRoute, {
    onOffRoute: handleOffRouteCallback,
    onArrive: () => {
        console.log("Arrival detected by useRoute hook.");
    }
  });

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const liveUserLocationRef = useRef(liveUserLocation);

  useEffect(() => {
    liveUserLocationRef.current = liveUserLocation;
  }, [liveUserLocation]);

  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (isNavigating && destination) {
      refreshTimerRef.current = setInterval(async () => {
        if (!liveUserLocationRef.current) {
          console.warn("Cannot refresh route data: No live user location available (from ref)");
          return;
        }
        try {
          const response = await fetchRoute(liveUserLocationRef.current, destination, {
            excludes: routeExcludes,
            alternatives: false,
          });
          if (response.routes.length > 0) {
            updateNavigationMetrics(response.routes[0]);
          }
        } catch (error) {
          console.warn("Failed to refresh route data:", error);
        }
      }, ROUTE_API_REFRESH_INTERVAL);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [isNavigating, destination, routeExcludes, updateNavigationMetrics]);

  // Recalculate routes if preferences (routeExcludes) change during navigation or planning
  useEffect(() => {
    if (!isNavigating && initialOrigin && destination && !calculationLoading && !isRerouting) {
        // If not navigating, recalculate from initialOrigin if it exists, or liveUserLocation
        const originToUse = initialOrigin || liveUserLocationRef.current;
        if(originToUse) {
            console.log("Route excludes changed, recalculating planned routes from:", originToUse);
            calculateRoutes(originToUse, destination, routeExcludes);
        }
    } else if (isNavigating && liveUserLocationRef.current && destination && !calculationLoading && !isRerouting) {
        // If navigating, a change in excludes should trigger a reroute with new preferences
        console.log("Route excludes changed during navigation, triggering reroute with new preferences.");
        handleReroute(liveUserLocationRef.current, ttsManager.speak);
    }
  }, [routeExcludes]); // Removed other dependencies to focus on preference changes. Calculation/reroute will handle current state.


  const getRouteFeatures = useCallback((routeId: string): RouteFeatures | undefined => {
    return routeFeatures[routeId];
  }, [routeFeatures]);

  // This is the primary function the UI should call to start navigation.
  const startNavigation = useCallback(async () => {
    if (!selectedRoute) {
        console.error("Cannot start navigation: No route selected.");
        ttsManager.speak("Veuillez d'abord sélectionner un itinéraire.");
        return;
    }
    await startRouteNavigation(); // Call the function from useRouteNavigation
  }, [selectedRoute, startRouteNavigation]);

  // This is the primary function the UI should call to stop navigation.
  const stopNavigation = useCallback(() => {
    stopRouteNavigation(); // Call the function from useRouteNavigation
    // Additional cleanup if needed by useRoute itself
    // setSelectedRoute(null); // Consider if this should happen here or be managed by UI
    // setAlternateRoutes([]);
  }, [stopRouteNavigation]);


  // This is the function the UI should call for manual recalculation
  const recalculateCurrentRoute = useCallback(() => {
    if (!liveUserLocationRef.current || !destination) {
        console.warn("Cannot recalculate: missing current location or destination.");
        return;
    }
    console.log("Manual recalculation triggered.");
    handleReroute(liveUserLocationRef.current, ttsManager.speak);
  }, [destination, handleReroute]);


  return {
    selectedRoute,
    setSelectedRoute, // For UI to choose a route from alternatives
    alternateRoutes,
    setAlternateRoutes, // If UI directly manipulates alternatives
    loading: calculationLoading || isRerouting, // Combined loading state
    error: calculationError, // Only calculation error, rerouting errors are handled in its hook

    isNavigating,
    // setIsNavigating, // UI should use startNavigation/stopNavigation
    liveUserLocation,
    traveledCoords,
    displayedInstruction,
    distanceToNextManeuver,
    remainingDistance,
    remainingDuration,
    estimatedArrival,

    routeExcludes,
    setRouteExcludes,

    routeFeatures,
    getRouteFeatures,

    isRerouting, // Expose if UI needs to know specifically about rerouting phase

    startNavigation, // Expose the main start function
    stopNavigation,  // Expose the main stop function
    chooseRoute,     // For selecting among primary/alternates before navigation
    calculateRoutes, // For initial route planning by UI
    recalculateRoute: recalculateCurrentRoute, // For manual UI-triggered recalculation
  };
}