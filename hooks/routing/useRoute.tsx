// hooks/routing/useRoute.tsx
import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { useRouteCalculation } from "./useRouteCalculation";
import { useRouteNavigation } from "./useRouteNavigation";
import { useRouteRerouting } from "./useRouteRerouting";
import { Route } from "@/types/mapbox";
import { Coordinate, RouteFeatures } from "./utils/types";
import { fetchRoute } from "./utils/mapboxApi";
import ttsManager from "@/utils/ttsManager";
import { addItineraryStat } from "@/services/useService";

const ROUTE_API_REFRESH_INTERVAL = 60 * 1000;

// Helper to compare arrays for useEffect dependency
const TUPLE_SEPARATOR = "||";
const arrayToStableString = (arr: string[] | undefined): string => {
  if (!arr) return "";
  return [...arr].sort().join(TUPLE_SEPARATOR); // Sort for order-insensitivity
};

export default function useRoute(
  initialOrigin: Coordinate | null,
  destination: Coordinate | null
) {
  // routeExcludes: State for what to exclude (e.g., ['toll', 'motorway'])
  const [routeExcludes, setRouteExcludes] = useState<string[] | undefined>(
    undefined
  );
  const stableRouteExcludesString = useMemo(
    () => arrayToStableString(routeExcludes),
    [routeExcludes]
  );

  const {
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading: calculationLoading,
    error: calculationError,
    routeFeatures,
    chooseRoute,
    calculateRoutes, // This is for initial/manual route planning
  } = useRouteCalculation(initialOrigin, destination, routeExcludes); // routeExcludes is passed here

  const handleRerouteSuccess = useCallback(
    (newRoute: Route) => {
      console.log("useRoute: Reroute successful. Updating selected route.");
      setSelectedRoute(newRoute);
      setAlternateRoutes([]);
      ttsManager.speak("Nouvel itinéraire calculé.", true);
    },
    [setSelectedRoute, setAlternateRoutes]
  );

  const handleRerouteError = useCallback((error: Error) => {
    console.error("useRoute: Reroute failed.", error);
    ttsManager.speak("Impossible de recalculer l'itinéraire.", true);
  }, []);

  const {
    isRerouting,
    handleReroute, // This is the core rerouting function from useRouteRerouting
  } = useRouteRerouting(destination, routeExcludes, {
    // routeExcludes is passed here too
    onRerouteStart: () => console.log("useRoute: Reroute process started."),
    onRerouteSuccess: handleRerouteSuccess,
    onRerouteError: handleRerouteError,
  });

  // This callback is triggered by useRouteNavigation when the user is detected off-route.
  const onOffRouteDeviation = useCallback(
    (userLocation: Coordinate) => {
      if (!isRerouting && destination) {
        console.log(
          "useRoute: User deviated off-route. Initiating handleReroute."
        );
        // Pass the current ttsManager.speak instance or a stable wrapper
        handleReroute(userLocation, (text, isChange) =>
          ttsManager.speak(text, isChange)
        );
      } else {
        console.log(
          "useRoute: Off-route deviation - reroute skipped (already rerouting or no destination)."
        );
      }
    },
    [destination, isRerouting, handleReroute]
  ); // handleReroute from useRouteRerouting should be stable

  const {
    isNavigating,
    setIsNavigating, // useRouteNavigation controls this based on start/stop/arrival
    liveUserLocation,
    traveledCoords,
    displayedInstruction,
    distanceToNextManeuver,
    startNavigation: startRouteNavigationInternal,
    stopNavigation: stopRouteNavigationInternal,
    updateNavigationMetrics,
    remainingDistance,
    remainingDuration,
    estimatedArrival,
  } = useRouteNavigation(selectedRoute, {
    onOffRoute: onOffRouteDeviation, // This is the primary trigger for rerouting due to physical deviation
    onArrive: () => {
      console.log("useRoute: Arrival detected.");
      // setIsNavigating(false); // Already handled within useRouteNavigation
      // Send itinerary stats to backend
      if (selectedRoute) {
        addItineraryStat({
          estimated_distance: Math.round(selectedRoute.distance),
          estimated_time: Math.round(selectedRoute.duration),
        }).catch((err) => {
          console.error("Failed to send itinerary stats:", err);
        });
      }
    },
  });

  const liveUserLocationRef = useRef(liveUserLocation);
  useEffect(() => {
    liveUserLocationRef.current = liveUserLocation;
  }, [liveUserLocation]);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    // Periodic refresh for ETA/traffic
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (isNavigating && destination && liveUserLocationRef.current) {
      refreshTimerRef.current = setInterval(async () => {
        if (!liveUserLocationRef.current) return;
        try {
          const response = await fetchRoute(
            liveUserLocationRef.current,
            destination,
            {
              excludes: routeExcludes,
              alternatives: false,
            }
          );
          if (response.routes.length > 0)
            updateNavigationMetrics(response.routes[0]);
        } catch (error) {
          console.warn("Failed to refresh route data:", error);
        }
      }, ROUTE_API_REFRESH_INTERVAL);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [isNavigating, destination, routeExcludes, updateNavigationMetrics]); // routeExcludes is needed if refresh should use current excludes

  // This useEffect handles changes to routeExcludes (e.g., from user settings)
  // or when the destination changes (e.g., new QR scan or search after initial).
  // It should only run when these specific values *actually change*.
  const prevStableRouteExcludesString = useRef(stableRouteExcludesString);
  const prevDestination = useRef(destination);

  useEffect(() => {
    const destinationChanged =
      prevDestination.current !== destination && destination !== null;
    const excludesChanged =
      prevStableRouteExcludesString.current !== stableRouteExcludesString;

    // Update refs for next comparison
    prevDestination.current = destination;
    prevStableRouteExcludesString.current = stableRouteExcludesString;

    if (!destination) {
      // If destination becomes null (e.g., search cancelled), clear routes
      if (selectedRoute) setSelectedRoute(null);
      if (alternateRoutes.length > 0) setAlternateRoutes([]);
      return;
    }

    if (destinationChanged || excludesChanged) {
      console.log(
        `useRoute: Destination or Excludes changed. DestChanged: ${destinationChanged}, ExclChanged: ${excludesChanged}`
      );
      const originToUse = liveUserLocationRef.current || initialOrigin;

      if (originToUse) {
        if (isNavigating) {
          // If navigating and preferences/destination change, trigger a reroute.
          console.log(
            "--> Rerouting due to preference/destination change while navigating."
          );
          if (!isRerouting) {
            // Avoid triggering if already rerouting for other reasons
            handleReroute(originToUse, (text, isChange) =>
              ttsManager.speak(text, isChange)
            );
          }
        } else {
          // If not navigating (i.e., in planning mode), recalculate all routes.
          console.log(
            "--> Recalculating all routes for planning due to preference/destination change."
          );
          calculateRoutes(originToUse, destination, routeExcludes);
        }
      } else {
        console.warn(
          "useRoute: Cannot calculate/reroute due to changed prefs/dest - no valid origin (live or initial)."
        );
      }
    }
  }, [
    stableRouteExcludesString, // Stable string representation of excludes
    destination, // The destination itself
    // Below are functions/states that are part of the logic but shouldn't trigger the effect on their own re-creation
    // if their underlying values haven't changed.
    isNavigating,
    initialOrigin, // initialOrigin is stable
    calculateRoutes, // from useRouteCalculation (should be stable via useCallback)
    handleReroute, // from useRouteRerouting (should be stable via useCallback)
    isRerouting,
    // Dependencies for clearing routes:
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
  ]);

  const startNavigation = useCallback(async () => {
    if (!selectedRoute) {
      console.error("useRoute: Cannot start navigation - No route selected.");
      ttsManager.speak("Veuillez d'abord sélectionner un itinéraire.", true);
      return;
    }
    // setIsNavigating(true) will be called by startRouteNavigationInternal
    await startRouteNavigationInternal();
  }, [selectedRoute, startRouteNavigationInternal]);

  const stopNavigation = useCallback(() => {
    // setIsNavigating(false) will be called by stopRouteNavigationInternal
    stopRouteNavigationInternal();
  }, [stopRouteNavigationInternal]);

  // For the UI button "Recalculate" - user manually requests a new route.
  const manualRecalculateRoute = useCallback(() => {
    if (!liveUserLocationRef.current || !destination) {
      console.warn(
        "useRoute: Manual recalculate skipped - missing current location or destination."
      );
      ttsManager.speak(
        "Impossible de recalculer l'itinéraire maintenant.",
        true
      );
      return;
    }
    if (isRerouting) {
      console.log("useRoute: Manual recalculate skipped - already rerouting.");
      return;
    }
    console.log("useRoute: Manual recalculation initiated.");
    handleReroute(liveUserLocationRef.current, (text, isChange) =>
      ttsManager.speak(text, isChange)
    );
  }, [destination, isRerouting, handleReroute]);

  return {
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading: calculationLoading || isRerouting,
    error: calculationError,
    isNavigating,
    liveUserLocation,
    traveledCoords,
    displayedInstruction,
    distanceToNextManeuver,
    remainingDistance,
    remainingDuration,
    estimatedArrival,
    routeExcludes,
    setRouteExcludes, // Allow UI (e.g., settings) to change preferences
    routeFeatures,
    isRerouting,
    startNavigation,
    stopNavigation,
    chooseRoute,
    calculateRoutes, // For initial planning (e.g., after search selection)
    recalculateRoute: manualRecalculateRoute, // For the UI's "Recalculate" button
  };
}
