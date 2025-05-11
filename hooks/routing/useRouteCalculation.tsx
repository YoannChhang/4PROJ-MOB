import { useState, useEffect, useCallback, useRef } from "react";
import { Route, MapboxDirectionsResponse } from "@/types/mapbox";
import { fetchRoute } from "./utils/mapboxApi";
import {
  initializeRouteFeatures,
  calculatePathSimilarity,
  analyzeTrafficLevel,
} from "./utils/routeAnalysis";
import { Coordinate, RouteFeatures } from "./utils/types";
import { formatDuration, formatDistance } from "./utils/formatters";

/**
 * Hook for handling route calculation logic with pre-computed features
 * @param initialOrigin Starting coordinates [longitude, latitude]
 * @param initialDestination Ending coordinates [longitude, latitude]
 * @param initialRouteExcludes Array of route features to exclude (e.g., ["toll", "motorway"])
 * @returns Route calculation state and functions
 */
export const useRouteCalculation = (
  initialOrigin: Coordinate | null,
  initialDestination: Coordinate | null,
  initialRouteExcludes: string[] | undefined
) => {
  // Core routing state
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [alternateRoutes, setAlternateRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [routeFeatures, setRouteFeatures] = useState<
    Record<string, RouteFeatures>
  >({});

  // Track if initial calculation has been done
  const initialCalculationDone = useRef(false);

  /**
   * Calculate all route features at once including tolls, highways, and unpaved roads
   * @param routes Array of routes to analyze
   * @param originPoint Starting point
   * @param destinationPoint Ending point
   * @returns Computed features for all routes
   */
  const calculateAllRouteFeatures = async (
    routes: Route[],
    originPoint: Coordinate,
    destinationPoint: Coordinate
  ): Promise<Record<string, RouteFeatures>> => {
    // Initialize features with basic information
    const features: Record<string, RouteFeatures> = {};

    routes.forEach((route, index) => {
      const routeId = index === 0 ? "primary" : `alternate-${index - 1}`;

      features[routeId] = {
        hasHighways: false,
        hasTolls: false,
        hasUnpavedRoads: false,
        estimatedTime: formatDuration(route.duration),
        distance: formatDistance(route.distance),
        trafficLevel: analyzeTrafficLevel(route),
      };
    });

    try {
      // Set up exclusion combinations to test
      const exclusionCombinations = [
        { excludes: ["motorway"], feature: "hasHighways" },
        { excludes: ["toll"], feature: "hasTolls" },
        { excludes: ["unpaved"], feature: "hasUnpavedRoads" },
      ];

      // Fetch routes with each exclusion type
      console.log("Fetching routes with exclusions to detect features...");
      const exclusionResults = await Promise.all(
        exclusionCombinations.map((combo) =>
          fetchRoute(originPoint, destinationPoint, {
            excludes: combo.excludes,
          })
        )
      );

      // Compare original routes with excluded routes to detect features
      routes.forEach((route, routeIndex) => {
        const routeId =
          routeIndex === 0 ? "primary" : `alternate-${routeIndex - 1}`;

        exclusionCombinations.forEach((combo, exclusionIndex) => {
          const excludedRoutes = exclusionResults[exclusionIndex].routes;
          if (!excludedRoutes.length) return;

          const excludedRoute = excludedRoutes[0];

          // Calculate duration difference
          const durationDifference = Math.abs(
            excludedRoute.duration - route.duration
          );
          const percentageDifference =
            (durationDifference / route.duration) * 100;

          // Calculate path similarity
          const pathSimilarity = calculatePathSimilarity(route, excludedRoute);

          // Detect if route has the excluded feature
          // Feature is considered present if:
          // 1. Duration changes by more than 15% when excluding it, OR
          // 2. The path similarity is less than 75% when excluding it
          const hasFeature = percentageDifference > 15 || pathSimilarity < 0.75;

          // Update feature status
          if (combo.feature && features[routeId]) {
            // @ts-ignore - We know this is safe because we control the feature names
            features[routeId][combo.feature] = hasFeature;
          }
        });
      });

      console.log("Feature detection complete");
    } catch (error) {
      console.error("Error during route feature detection:", error);
      // Continue with basic features if advanced detection fails
    }

    return features;
  };

  /**
   * Explicit function to calculate routes when requested
   */
  const calculateRoutes = useCallback(
    async (
      origin: Coordinate | null,
      destination: Coordinate | null,
      excludes?: string[]
    ) => {
      if (!origin || !destination) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch routes from Mapbox API
        const response = await fetchRoute(origin, destination, {
          excludes: excludes || [],
          alternatives: true,
        });

        if (response.routes.length > 0) {
          const primaryRoute = response.routes[0];
          const otherRoutes = response.routes.slice(1);

          // Set initial routes
          setSelectedRoute(primaryRoute);
          setAlternateRoutes(otherRoutes);

          // Calculate all features at once
          const allRoutes = [primaryRoute, ...otherRoutes];
          console.log("Calculating route features...");
          const features = await calculateAllRouteFeatures(
            allRoutes,
            origin,
            destination
          );
          setRouteFeatures(features);
        } else {
          setError("No routes found");
        }
      } catch (err) {
        console.error("Error fetching routes:", err);
        setError("Failed to fetch routes");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Choose a different route
   * @param route Route to select
   * @param previousRoute Previously selected route
   */
  const chooseRoute = useCallback(
    (route: Route, previousRoute: Route | null) => {
      // Don't do anything if the same route is selected
      if (previousRoute === route) return;

      // Update selected route
      setSelectedRoute(route);

      // Update alternate routes (filter out the newly selected route)
      if (previousRoute) {
        setAlternateRoutes((prev) =>
          [...prev.filter((r) => r !== route), previousRoute].sort(
            (a, b) => a.duration - b.duration
          )
        );
      } else {
        setAlternateRoutes((prev) => prev.filter((r) => r !== route));
      }
    },
    []
  );

  return {
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading,
    error,
    routeFeatures,
    setRouteFeatures,
    chooseRoute,
    calculateRoutes,
  };
};
