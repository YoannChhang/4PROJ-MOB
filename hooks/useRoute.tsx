import React, { useState, useEffect, useMemo } from "react";
import MapboxGL from "@rnmapbox/maps";
import { MapboxDirectionsResponse, Route } from "@/types/mapbox";

interface RouteHookReturn {
  selectedRoute: Route | null;
  setSelectedRoute: React.Dispatch<React.SetStateAction<Route | null>>;
  alternateRoutes: Route[];
  setAlternateRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
  chooseRoute: (route: Route, prevSelectedRoute: Route | null) => void;
  traveledCoords: GeoJSON.Position[];
  loading: boolean;
  error: string | null;
  liveUserLocation: GeoJSON.Position | null;
  isNavigating: boolean;
  startNavigation: () => void;
  stopNavigation: () => void;
}

const MAX_DEVIATION_DISTANCE = 50;

const useRoute = (
  origin: GeoJSON.Position | null,
  destination: GeoJSON.Position | null
): RouteHookReturn => {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [alternateRoutes, setAlternateRoutes] = useState<Route[]>([]);

  const [traveledCoords, setTraveledCoords] = useState<GeoJSON.Position[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [liveUserLocation, setUserLocation] = useState<GeoJSON.Position | null>(
    null
  );
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  const chooseRoute = (newRoute: Route, prevSelectedRoute: Route | null) => {
    console.log(
      `Previous Route Duration: ${prevSelectedRoute?.duration || "N/A"} seconds`
    );
    console.log(`New Route Duration: ${newRoute.duration} seconds`);

    if (!prevSelectedRoute) {
      setSelectedRoute(newRoute);
      return;
    }
    setSelectedRoute(newRoute);
    setAlternateRoutes((prev) => [
      prevSelectedRoute,
      ...prev.filter((r) => r !== newRoute),
    ]);
  };

  const fetchRoute = async (start: GeoJSON.Position, end: GeoJSON.Position) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start.join(
        ","
      )};${end.join(
        ","
      )}?geometries=geojson&overview=full&alternatives=true&access_token=${
        process.env.EXPO_PUBLIC_MAPBOX_SK
      }`;
      const tollFreeUrl = `${url}&exclude=toll`;

      const response = await fetch(url);
      const tollFreeResponse = await fetch(tollFreeUrl);

      const data = (await response.json()) as MapboxDirectionsResponse;
      const tollFreeData =
        (await tollFreeResponse.json()) as MapboxDirectionsResponse;

      if (!data.routes.length && !tollFreeData.routes.length) {
        setError("No route found.");
      }

      if (data.routes.length) {
        setSelectedRoute(data.routes[0]);
        setAlternateRoutes(data.routes.slice(1));
        setTraveledCoords([]); // Reset traveled route
      }

      if (tollFreeData.routes.length) {
        tollFreeData.routes.forEach((tollFreeRoute) => {
          const isDuplicate =
            data.routes.some(
              (route) =>
                JSON.stringify(route.geometry) ===
                JSON.stringify(tollFreeRoute.geometry)
            ) ||
            (selectedRoute &&
              JSON.stringify(selectedRoute.geometry) ===
                JSON.stringify(tollFreeRoute.geometry));

          if (!isDuplicate) {
            setAlternateRoutes((prev) => [...prev, tollFreeRoute]);
          }
        });
      }
    } catch (err) {
      setError("Failed to fetch route.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (origin && destination) {
      fetchRoute(origin, destination);
    }
  }, [origin, destination]);

  useEffect(() => {
    if (!isNavigating) return;

    const handleLocationUpdate = ({
      coords,
    }: {
      coords: { longitude: number; latitude: number };
    }) => {
      const currentLocation: GeoJSON.Position = [
        coords.longitude,
        coords.latitude,
      ];
      setUserLocation(currentLocation);

      if (!selectedRoute?.geometry.coordinates?.length) return;

      // Find the nearest point on the route
      const nearestPoint = selectedRoute.geometry.coordinates.reduce(
        (closest, point) => {
          return Math.hypot(
            point[0] - currentLocation[0],
            point[1] - currentLocation[1]
          ) <
            Math.hypot(
              closest[0] - currentLocation[0],
              closest[1] - currentLocation[1]
            )
            ? point
            : closest;
        }
      );

      if (!nearestPoint) return;

      // Calculate distance from route in meters
      const distanceFromRoute =
        Math.hypot(
          nearestPoint[0] - currentLocation[0],
          nearestPoint[1] - currentLocation[1]
        ) * 111320;

      if (distanceFromRoute < MAX_DEVIATION_DISTANCE) {
        const index = selectedRoute.geometry.coordinates.findIndex(
          (point) =>
            point[0] === nearestPoint[0] && point[1] === nearestPoint[1]
        );

        if (index !== -1) {
          setTraveledCoords(
            selectedRoute.geometry.coordinates.slice(0, index + 1)
          );
        }
      } else {
        console.log("Driver deviated, recalculating route...");
        fetchRoute(currentLocation, destination!);
      }
    };

    const trackUserLocation = async () => {
      await MapboxGL.locationManager.start();
      MapboxGL.locationManager.addListener(handleLocationUpdate);
    };

    trackUserLocation();
    return () => MapboxGL.locationManager.removeListener(handleLocationUpdate);
  }, [isNavigating, selectedRoute]);

  return {
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    chooseRoute,
    traveledCoords,
    loading,
    error,
    liveUserLocation,
    isNavigating,
    startNavigation: () => setIsNavigating(true),
    stopNavigation: () => setIsNavigating(false),
  };
};

export default useRoute;
