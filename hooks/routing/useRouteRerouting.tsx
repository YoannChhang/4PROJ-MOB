// hooks/routing/useRouteRerouting.tsx
import { useState, useRef, useCallback } from "react";
import * as turf from "@turf/turf";
import { recalculateRoute as fetchRecalculatedRoute } from "./utils/mapboxApi"; // Renamed import for clarity
import { Route } from "@/types/mapbox";
import { Coordinate } from "./utils/types";
import {
  RECALCULATION_DISTANCE_THRESHOLD,
  RECALCULATION_TIME_THRESHOLD,
} from "./utils/constants";

interface UseRouteReroutingOptions {
  onRerouteStart?: () => void;
  onRerouteSuccess?: (newRoute: Route) => void;
  onRerouteError?: (error: Error) => void;
}

export const useRouteRerouting = (
  destination: Coordinate | null,
  routeExcludes: string[] | undefined,
  options: UseRouteReroutingOptions = {}
) => {
  const { onRerouteStart, onRerouteSuccess, onRerouteError } = options;

  const [isRerouting, setIsRerouting] = useState<boolean>(false);
  const lastRerouteLocationRef = useRef<Coordinate | null>(null); // Changed to ref
  const lastRerouteTimeRef = useRef<number>(0); // Changed to ref

  const checkShouldRecalculate = useCallback(
    (userLocation: Coordinate): boolean => {
      const now = Date.now();
      if (isRerouting) {
        console.log("Rerouting: Already in progress, skipping check.");
        return false;
      }

      const timeSinceLastReroute = now - lastRerouteTimeRef.current;
      if (timeSinceLastReroute < RECALCULATION_TIME_THRESHOLD) {
        console.log(
          `Rerouting: Too soon. Time since last: ${timeSinceLastReroute}ms`
        );
        return false;
      }

      if (lastRerouteLocationRef.current) {
        const distanceSinceLastReroute = turf.distance(
          turf.point(userLocation),
          turf.point(lastRerouteLocationRef.current),
          { units: "meters" }
        );
        if (distanceSinceLastReroute < RECALCULATION_DISTANCE_THRESHOLD) {
          console.log(
            `Rerouting: Not moved enough. Distance since last: ${distanceSinceLastReroute}m`
          );
          return false;
        }
      }
      console.log("Rerouting: Conditions met to recalculate.");
      return true;
    },
    [isRerouting] // RECALCULATION_TIME_THRESHOLD & RECALCULATION_DISTANCE_THRESHOLD are constants
  );

  const handleReroute = useCallback(
    async (
      userLocation: Coordinate,
      speakInstruction: (
        instruction: string,
        isManeuverChange?: boolean
      ) => void // Matched signature
    ): Promise<Route | null> => {
      if (!destination) {
        console.log("Rerouting: No destination set.");
        return null;
      }
      if (!checkShouldRecalculate(userLocation)) {
        return null;
      }

      console.log("Rerouting: Starting reroute process.");
      setIsRerouting(true);
      lastRerouteLocationRef.current = userLocation;
      lastRerouteTimeRef.current = Date.now();

      if (onRerouteStart) onRerouteStart();

      try {
        speakInstruction("Recalcul d'itinéraire en cours", true); // Indicate it's a significant change
        const response = await fetchRecalculatedRoute(
          userLocation,
          destination,
          {
            // Use the renamed import
            excludes: routeExcludes,
          }
        );

        if (response.routes && response.routes.length > 0) {
          const newRoute = response.routes[0];
          console.log("Rerouting: New route successfully fetched.");
          if (onRerouteSuccess) {
            onRerouteSuccess(newRoute);
          }
          return newRoute;
        } else {
          console.warn("Rerouting: No routes returned from API.");
          if (onRerouteError)
            onRerouteError(new Error("No new routes found during reroute."));
          return null;
        }
      } catch (error) {
        console.error("Error during rerouting API call:", error);
        if (onRerouteError) {
          onRerouteError(
            error instanceof Error ? error : new Error(String(error))
          );
        }
        return null;
      } finally {
        setIsRerouting(false);
        console.log("Rerouting: Process finished.");
      }
    },
    [
      destination,
      routeExcludes,
      checkShouldRecalculate, // This is stable if its deps are stable
      onRerouteStart,
      onRerouteSuccess,
      onRerouteError,
      // speakInstruction is not a dependency here, it's passed in
    ]
  );

  return {
    isRerouting,
    // checkShouldRecalculate, // Not typically needed externally if handleReroute uses it
    handleReroute,
    // lastRerouteLocation: lastRerouteLocationRef.current, // Access via ref if needed, but usually not
    // lastRerouteTime: lastRerouteTimeRef.current,
  };
};
