// src/hooks/routing/useRouteCalculation.ts
import { useState, useEffect } from 'react';
import { Route, MapboxDirectionsResponse } from '@/types/mapbox';
import { fetchRoute } from './utils/mapboxApi';
import { initializeRouteFeatures } from './utils/routeAnalysis';
import { Coordinate, RouteFeatures } from './utils/types';

/**
 * Hook for handling route calculation logic
 * @param origin Starting coordinates [longitude, latitude]
 * @param destination Ending coordinates [longitude, latitude]
 * @param routeExcludes Array of route features to exclude (e.g., ["toll", "motorway"])
 * @returns Route calculation state and functions
 */
export const useRouteCalculation = (
  origin: Coordinate | null,
  destination: Coordinate | null,
  routeExcludes: string[] | undefined
) => {
  // Core routing state
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [alternateRoutes, setAlternateRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [routeFeatures, setRouteFeatures] = useState<Record<string, RouteFeatures>>({});

  // Calculate routes when origin or destination changes
  useEffect(() => {
    const calculateRoutes = async () => {
      if (!origin || !destination) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch routes from Mapbox API
        const response = await fetchRoute(origin, destination, {
          excludes: routeExcludes || [],
          alternatives: true
        });

        if (response.routes.length > 0) {
          const primaryRoute = response.routes[0];
          const otherRoutes = response.routes.slice(1);

          // Set initial routes
          setSelectedRoute(primaryRoute);
          setAlternateRoutes(otherRoutes);

          // Initialize basic features
          const initialFeatures = initializeRouteFeatures([
            primaryRoute,
            ...otherRoutes,
          ]);
          setRouteFeatures(initialFeatures);
        } else {
          setError("No routes found");
        }
      } catch (err) {
        console.error("Error fetching routes:", err);
        setError("Failed to fetch routes");
      } finally {
        setLoading(false);
      }
    };

    calculateRoutes();
  }, [origin, destination, routeExcludes]);

  /**
   * Choose a different route
   * @param route Route to select
   * @param previousRoute Previously selected route
   */
  const chooseRoute = (route: Route, previousRoute: Route | null) => {
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
  };

  return {
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading,
    error,
    routeFeatures,
    setRouteFeatures,
    chooseRoute
  };
};