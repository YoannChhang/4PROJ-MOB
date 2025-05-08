// src/hooks/routing/useRouteFeatures.ts
import { useState, useEffect, useRef } from 'react';
import { Route } from '@/types/mapbox';
import { fetchRoute } from './utils/mapboxApi';
import { 
  calculatePathSimilarity, 
  initializeRouteFeatures 
} from './utils/routeAnalysis';
import { Coordinate, RouteFeatures } from './utils/types';

interface UseRouteFeaturesOptions {
  enableAdvancedDetection?: boolean;
}

/**
 * Hook for handling route feature detection
 * @param origin Starting coordinates [longitude, latitude]
 * @param destination Ending coordinates [longitude, latitude]
 * @param routes Array of routes to analyze
 * @param setRouteFeatures Function to update route features
 * @param options Additional options
 * @returns Feature detection state and functions
 */
export const useRouteFeatures = (
  origin: Coordinate | null,
  destination: Coordinate | null,
  routes: Route[],
  setRouteFeatures: React.Dispatch<React.SetStateAction<Record<string, RouteFeatures>>>,
  options: UseRouteFeaturesOptions = {}
) => {
  const { enableAdvancedDetection = true } = options;
  
  const featureDetectionComplete = useRef<boolean>(false);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  /**
   * Enhanced feature detection using Mapbox API with different exclusions
   */
  const detectRouteFeatures = async (
    originPoint: Coordinate,
    destinationPoint: Coordinate,
    initialRoutes: Route[]
  ): Promise<void> => {
    if (!originPoint || !destinationPoint || !initialRoutes.length) {
      return;
    }

    setIsDetecting(true);

    try {
      // Initialize basic features
      const features = initializeRouteFeatures(initialRoutes);
      setRouteFeatures(features);

      // Only continue with advanced detection if enabled
      if (!enableAdvancedDetection) {
        featureDetectionComplete.current = true;
        setIsDetecting(false);
        return;
      }

      // Set up exclusion combinations to test
      const exclusionCombinations = [
        { excludes: ["motorway"], feature: "hasHighways" },
        { excludes: ["toll"], feature: "hasTolls" },
        { excludes: ["unpaved"], feature: "hasUnpavedRoads" },
        {
          excludes: ["toll", "motorway"],
          features: ["hasTolls", "hasHighways"],
        },
        {
          excludes: ["toll", "unpaved"],
          features: ["hasTolls", "hasUnpavedRoads"],
        },
        {
          excludes: ["motorway", "unpaved"],
          features: ["hasHighways", "hasUnpavedRoads"],
        },
      ];

      // Fetch baseline route with no exclusions
      const baselineResponse = await fetchRoute(
        originPoint,
        destinationPoint,
        { excludes: [] }
      );
      const baselineRoute = baselineResponse.routes[0];

      // For each exclusion combination, fetch routes and compare
      const exclusionResults = await Promise.all(
        exclusionCombinations.map((combo) =>
          fetchRoute(
            originPoint, 
            destinationPoint, 
            { excludes: combo.excludes }
          )
        )
      );

      // Analyze results for each initial route
      initialRoutes.forEach((route, routeIndex) => {
        const routeId = routeIndex === 0 ? "primary" : `alternate-${routeIndex - 1}`;
        const updateFeatures = { ...features[routeId] };

        // Compare with each exclusion result
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

          // Detect if this route has the excluded features
          // We consider a feature present if:
          // 1. Duration changes by more than 15% when excluding it, OR
          // 2. The path similarity is less than 75% when excluding it
          const hasFeature = percentageDifference > 15 || pathSimilarity < 0.75;

          // Update features based on the exclusion combination
          if (combo.feature) {
            // Single feature exclusion
            // @ts-ignore - We know this is safe because we control the feature names
            updateFeatures[combo.feature] = hasFeature;
          } else if (combo.features) {
            // Multiple feature exclusion - if there's a significant difference,
            // check which individual features are most likely present
            if (hasFeature) {
              // Look at individual exclusion results for more precise detection
              combo.features.forEach((feature) => {
                const singleFeatureIndex = exclusionCombinations.findIndex(
                  (c) => c.feature === feature
                );

                if (singleFeatureIndex >= 0) {
                  const singleExcludedRoute =
                    exclusionResults[singleFeatureIndex].routes[0];
                  const singleDurationDiff = Math.abs(
                    singleExcludedRoute.duration - route.duration
                  );
                  const singlePercentDiff =
                    (singleDurationDiff / route.duration) * 100;

                  // If individual exclusion also shows significant change, mark as present
                  if (singlePercentDiff > 10) {
                    // @ts-ignore - We know this is safe
                    updateFeatures[feature] = true;
                  }
                }
              });
            }
          }
        });

        // Update features for this route
        setRouteFeatures((prev) => ({
          ...prev,
          [routeId]: updateFeatures,
        }));
      });

      // Mark feature detection as complete
      featureDetectionComplete.current = true;
    } catch (error) {
      console.error("Error during route feature detection:", error);
      // Feature detection failed, but basic routes are still available
      featureDetectionComplete.current = true;
    } finally {
      setIsDetecting(false);
    }
  };

  // Start feature detection when origin, destination, and routes change
  useEffect(() => {
    if (origin && destination && routes.length > 0) {
      detectRouteFeatures(origin, destination, routes);
    }
  }, [origin, destination, routes]);

  // Check if feature detection is still in progress
  const isFeatureDetectionInProgress = (): boolean => {
    return isDetecting || !featureDetectionComplete.current;
  };

  // Get features for a specific route
  const getRouteFeatures = (routeId: string): RouteFeatures | undefined => {
    return {} as RouteFeatures; // Will be replaced by actual implementation
  };

  return {
    isFeatureDetectionInProgress,
    getRouteFeatures,
    detectRouteFeatures
  };
};