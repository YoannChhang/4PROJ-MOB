import { useState, useEffect } from "react";
import MapboxGL from "@rnmapbox/maps";

type Coordinates = [number, number];

interface RouteHookReturn {
  routeCoords: Coordinates[];
  traveledCoords: Coordinates[];
  loading: boolean;
  error: string | null;
  liveUserLocation: Coordinates | null;
  isNavigating: boolean;
  startNavigation: () => void;
  stopNavigation: () => void;
}

const MAX_DEVIATION_DISTANCE = 50;

const useRoute = (origin: Coordinates | null, destination: Coordinates | null): RouteHookReturn => {
  const [routeCoords, setRouteCoords] = useState<Coordinates[]>([]);
  const [traveledCoords, setTraveledCoords] = useState<Coordinates[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [liveUserLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  const fetchRoute = async (start: Coordinates, end: Coordinates) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start.join(",")};${end.join(",")}?geometries=geojson&access_token=${process.env.EXPO_PUBLIC_MAPBOX_SK}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes.length) {
        setRouteCoords(data.routes[0].geometry.coordinates);
        setTraveledCoords([]); // Reset traveled route
      } else {
        setError("No route found.");
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

    const handleLocationUpdate = ({ coords }: { coords: { longitude: number; latitude: number } }) => {
      const currentLocation: Coordinates = [coords.longitude, coords.latitude];
      setUserLocation(currentLocation);

      if (routeCoords.length > 0) {
        const nearestPoint = routeCoords.reduce((prev, curr) =>
          Math.hypot(curr[0] - currentLocation[0], curr[1] - currentLocation[1]) <
          Math.hypot(prev[0] - currentLocation[0], prev[1] - currentLocation[1])
            ? curr
            : prev
        );

        const distanceFromRoute = Math.hypot(
          nearestPoint[0] - currentLocation[0],
          nearestPoint[1] - currentLocation[1]
        ) * 111320;

        if (distanceFromRoute < MAX_DEVIATION_DISTANCE) {
          const index = routeCoords.indexOf(nearestPoint);
          setTraveledCoords(routeCoords.slice(0, index + 1)); // Move traveled points to a separate array
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
  }, [isNavigating, routeCoords]);

  return {
    routeCoords,
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
