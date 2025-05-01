import React, { useState, useEffect, useMemo } from "react";
import { Platform } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { MapboxDirectionsResponse, Route } from "@/types/mapbox";
import { RoutingPreference } from "@/components/settings/RoutingPreferences";
import { useUser } from "@/providers/UserProvider";
import Config from "react-native-config";

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
  currentInstruction: string;
  setRouteExcludes: React.Dispatch<React.SetStateAction<string[] | undefined>>;
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
  const [routeExcludes, setRouteExcludes] = useState<string[] | undefined>(undefined);

  const [traveledCoords, setTraveledCoords] = useState<GeoJSON.Position[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [liveUserLocation, setUserLocation] = useState<GeoJSON.Position | null>(
    null
  );
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [currentInstruction, setCurrentInstruction] = useState<string>("");

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
        Config.EXPO_PUBLIC_MAPBOX_PK
      }`;

      // Apply routing preferences to create different URLs
      let exclude: string[] = [];
      let urls: { url: string; label: string }[] = [];

      // IMPORTANT: Check if QR code provided excludes - these take precedence
      if (routeExcludes && routeExcludes.length > 0) {
        // Use QR code excludes directly
        exclude = [...routeExcludes];
        console.log('Using QR code excludes:', exclude);
      } else {
        // Otherwise, fall back to user preferences
        console.log('Using user preferences for routing');
        const avoidTolls =
          preferences.find((p) => p.id === "avoid_tolls")?.enabled || false;
        const avoidHighways =
          preferences.find((p) => p.id === "avoid_highways")?.enabled || false;
        const avoidUnpaved =
          preferences.find((p) => p.id === "avoid_unpaved")?.enabled || false;

        // Apply user preferences
        if (avoidTolls) exclude.push("toll");
        if (avoidHighways) exclude.push("motorway");
        if (avoidUnpaved) exclude.push("unpaved");
      }

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

      // Always add alternative routes with different exclusion parameters
      // for user to choose from, regardless of QR code or preferences
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
      console.error('Error in fetchRoute:', err);
      // Log detailed error information to help debugging
      if (err instanceof Error) {
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
      }
      
      // Check for common issues
      if (!origin || !destination) {
        console.error('Missing coordinates:', { origin, destination });
      }
      
      if (!Array.isArray(origin) || !Array.isArray(destination)) {
        console.error('Invalid coordinate format:', { origin, destination });
      }
      
      setError("Failed to fetch route.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (origin && destination) {
      fetchRoute(origin, destination);
    }
  }, [origin, destination, routeExcludes]); // Added routeExcludes to dependencies

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
          const newTraveledCoords = selectedRoute.geometry.coordinates.slice(
            0,
            index + 1
          );
          setTraveledCoords(newTraveledCoords);

          // Update current instruction
          if (selectedRoute.legs && selectedRoute.legs.length > 0) {
            const currentLeg = selectedRoute.legs[0];
            if (currentLeg.steps && currentLeg.steps.length > 0) {
              // Find the step that corresponds to the current index
              const currentStep = currentLeg.steps.find((step) => {
                const stepIndex = selectedRoute.geometry.coordinates.findIndex(
                  (coord) =>
                    coord[0] === step.geometry.coordinates[0][0] &&
                    coord[1] === step.geometry.coordinates[0][1]
                );
                return stepIndex === index;
              });

              if (currentStep) {
                setCurrentInstruction(
                  currentStep.maneuver?.instruction || "Continue straight"
                );
              }
            }
          }
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
  }, [isNavigating, selectedRoute, destination]);

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
    startNavigation: () => {
      setIsNavigating(true);
      // Set initial instruction from the first step
      if (selectedRoute?.legs?.[0]?.steps?.[0]?.maneuver?.instruction) {
        setCurrentInstruction(
          selectedRoute.legs[0].steps[0].maneuver.instruction
        );
      } else {
        setCurrentInstruction("Starting navigation");
      }
    },
    stopNavigation: () => setIsNavigating(false),
    currentInstruction: currentInstruction,
    setRouteExcludes,
  };
};

export default useRoute;