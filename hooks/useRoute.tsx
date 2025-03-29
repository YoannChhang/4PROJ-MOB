import React, { useState, useEffect, useMemo } from "react";
import { Platform } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { MapboxDirectionsResponse, Route } from "@/types/mapbox";
import { RoutingPreference } from "@/components/settings/RoutingPreferences";
import { useUser } from "@/providers/UserProvider";

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

interface RouteOptions {
  preferences?: RoutingPreference[];
}

const useRoute = (
  origin: GeoJSON.Position | null,
  destination: GeoJSON.Position | null
): RouteHookReturn => {
  // Get user data and preferences from context
  const { userData } = useUser();

  const preferences = useMemo(() => {
    return Object.entries(userData.preferences).map(([key, value]) => ({
      id: key,
      enabled: value,
    }));
  }, [userData.preferences]);

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
      // Base URL for the Mapbox Directions API
      const baseUrl = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${start.join(
        ","
      )};${end.join(
        ","
      )}?geometries=geojson&overview=full&alternatives=true&steps=true&language=fr&banner_instructions=true&voice_instructions=true&voice_units=metric&access_token=${
        process.env.EXPO_PUBLIC_MAPBOX_SK
      }`;

      // console.log(baseUrl);

      // Apply routing preferences to create different URLs
      let exclude: string[] = [];
      let urls: { url: string; label: string }[] = [];

      // Check for routing preferences
      const avoidTolls =
        preferences.find((p) => p.id === "avoidTolls")?.enabled || false;
      const avoidHighways =
        preferences.find((p) => p.id === "avoidHighways")?.enabled || false;
      // const avoidFerries =
      //   preferences.find((p) => p.id === "avoidFerries")?.enabled || false;
      const avoidUnpaved =
        preferences.find((p) => p.id === "avoidUnpaved")?.enabled || false;

      // Default URL
      // urls.push({ url: baseUrl, isPreferred: !Boolean(avoidTolls || avoidHighways || avoidUnpaved), label: "Default" });

      // Apply preferences
      if (avoidTolls) exclude.push("toll");

      // if (avoidFerries) exclude.push('ferry');

      if (avoidHighways) exclude.push("motorway");

      if (avoidUnpaved) exclude.push("unpaved");

      // Add URL with exclusions if any
      if (exclude.length > 0) {
        const excludeUrl = `${baseUrl}&exclude=${exclude.join(",")}`;
        urls.push({
          url: excludeUrl,
          label: `Default`,
        });
      } else {
        urls.push({
          url: baseUrl,
          label: `Default`,
        });
      }

      const avoidHighwaysUrl = `${baseUrl}&exclude=motorway`;
      const avoidTollsUrl = `${baseUrl}&exclude=toll`;
      const avoidUnpavedUrl = `${baseUrl}&exclude=unpaved`;

      urls.push({
        url: avoidHighwaysUrl,
        label: `No highways`,
      });

      urls.push({
        url: avoidTollsUrl,
        label: `No tolls`,
      });

      urls.push({
        url: avoidUnpavedUrl,
        label: `No unpaved`,
      });

      // Fetch routes for all URLs
      const responses = await Promise.all(urls.map(({ url }) => fetch(url)));
      const dataResults = await Promise.all(
        responses.map(
          (response) => response.json() as Promise<MapboxDirectionsResponse>
        )
      );

      const defaultRouteResponse = dataResults.shift();

      // Process results
      let allRoutes: Route[] =
        defaultRouteResponse?.routes.map((route) => {
          return { ...route, is_prefered: true, weight_name: "" };
        }) ?? [];

      // Process all routes from different URL requests
      dataResults.forEach((data, index) => {
        if (!data.routes.length) return;

        const urlInfo = urls[index + 1];

        // Add routes to pool, marking preferred ones
        data.routes.forEach((route) => {
          const foundIndex = allRoutes.findIndex(
            (existingRoute) =>
              JSON.stringify(existingRoute.geometry) ===
              JSON.stringify(route.geometry)
          );

          if (foundIndex === -1) {
            route.weight_name = urlInfo.label;
            route.is_prefered = false;
            allRoutes.push(route);
          } else {
            const foundRoute = allRoutes[foundIndex];
            allRoutes[foundIndex] = {
              ...foundRoute,
              weight_name: foundRoute.weight_name
                ? `${urlInfo.label}, ${foundRoute.weight_name}`
                : urlInfo.label,
            };
          }
        });
      });

      allRoutes.sort((a, b) => {
        if (a.is_prefered !== b.is_prefered) {
          return a.is_prefered ? -1 : 1; // isPrefered: true first
        }
        return a.weight - b.weight; // then by ascending weight
      });

      // If no routes found from any request
      if (allRoutes.length === 0) {
        setError("No route found.");
        return;
      } else if (allRoutes.length > 0) {
        // If no main route but we have alternates
        setSelectedRoute(allRoutes[0]);
        setAlternateRoutes(allRoutes.slice(1));
      }

      setTraveledCoords([]); // Reset traveled route
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
