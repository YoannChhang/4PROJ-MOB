import { useState, useEffect, useMemo } from "react";
import MapboxGL from "@rnmapbox/maps";
import { MapboxDirectionsResponse, Route } from "@/types/mapbox";


interface RouteHookReturn {
  selectedRoute: Route | null;
  alternateRoutes: Route[];
  selectedRouteCoords: GeoJSON.Position[];
  alternateRoutesCoords: GeoJSON.Position[][];
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
  // const [selectedRouteCoords, setSelectedRouteCoords] = useState<GeoJSON.Position[]>(
  //   []
  // );
  // const [alternateRoutesCoords, setAlternateRoutesCoords] = useState<GeoJSON.Position[][]>([]);
  const [traveledCoords, setTraveledCoords] = useState<GeoJSON.Position[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [liveUserLocation, setUserLocation] = useState<GeoJSON.Position | null>(
    null
  );
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  const selectedRouteCoords = useMemo(() => selectedRoute?.geometry.coordinates || [], [selectedRoute]);
  const alternateRoutesCoords = useMemo(() => alternateRoutes.map((route) => route.geometry.coordinates), [alternateRoutes]);


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

      const data = await response.json() as MapboxDirectionsResponse;
      const tollFreeData = await tollFreeResponse.json() as MapboxDirectionsResponse;

      if (!data.routes.length && !tollFreeData.routes.length) {
        setError("No route found.");
      }

      if (data.routes.length) {
        setSelectedRoute(data.routes[0]);
        setAlternateRoutes(data.routes.slice(1));
        setTraveledCoords([]); // Reset traveled route
      }

      if (tollFreeData.routes.length) {
        // console.log("tollFreeData", tollFreeData);
        setAlternateRoutes((prev) => [...prev, ...tollFreeData.routes]);
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
      const currentLocation: GeoJSON.Position = [coords.longitude, coords.latitude];
      setUserLocation(currentLocation);

      if (selectedRouteCoords.length > 0) {
        const nearestPoint = selectedRouteCoords.reduce((prev, curr) =>
          Math.hypot(
            curr[0] - currentLocation[0],
            curr[1] - currentLocation[1]
          ) <
          Math.hypot(prev[0] - currentLocation[0], prev[1] - currentLocation[1])
            ? curr
            : prev
        );

        const distanceFromRoute =
          Math.hypot(
            nearestPoint[0] - currentLocation[0],
            nearestPoint[1] - currentLocation[1]
          ) * 111320;

        if (distanceFromRoute < MAX_DEVIATION_DISTANCE) {
          const index = selectedRouteCoords.indexOf(nearestPoint);
          setTraveledCoords(selectedRouteCoords.slice(0, index + 1)); // Move traveled points to a separate array
        } else {
          console.log("Driver deviated, recalculating route...");
          fetchRoute(currentLocation, destination!);
        }
      }
    };

    const trackUserLocation = async () => {
      await MapboxGL.locationManager.start();
      MapboxGL.locationManager.addListener(handleLocationUpdate);
    };

    trackUserLocation();
    return () => MapboxGL.locationManager.removeListener(handleLocationUpdate);
  }, [isNavigating, selectedRouteCoords]);

  return {
    selectedRoute,
    alternateRoutes,
    selectedRouteCoords,
    alternateRoutesCoords,
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
