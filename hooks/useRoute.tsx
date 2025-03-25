import React, { useState, useEffect, useMemo } from "react";
import { Platform } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { MapboxDirectionsResponse, Route } from "@/types/mapbox";
import { RoutingPreference } from "@/components/settings/RoutingPreferences";
import { useUser } from "@/providers/UserProvider";
import { PreferredTravelMethodEnum } from "@/types/api";

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
  destination: GeoJSON.Position | null,
  options?: RouteOptions
): RouteHookReturn => {
  // Get user data and preferences from context
  const { userData } = useUser();
  
  // Combine options preferences with user preferences
  const userPrefs = userData?.preferences;
  const optionsPrefs = options?.preferences || [];
  
  // Map from API preferences to UI preferences for the routing system
  const mappedUserPrefs: RoutingPreference[] = useMemo(() => {
    if (!userPrefs) return [];
    
    return [
      { 
        id: 'avoidTolls', 
        label: 'Avoid Tolls', 
        enabled: userPrefs.avoid_tolls || false 
      },
      { 
        id: 'preferHighways', 
        label: 'Prefer Highways', 
        enabled: userPrefs.preferred_travel_method === PreferredTravelMethodEnum.DRIVING || true 
      },
      { 
        id: 'avoidFerries', 
        label: 'Avoid Ferries', 
        enabled: userPrefs.avoid_ferries || false 
      },
    ];
  }, [userPrefs]);
  
  // Combine preferences, with options taking precedence
  const prefMap = new Map<string, boolean>();
  
  // First add user preferences
  mappedUserPrefs.forEach(pref => {
    prefMap.set(pref.id, pref.enabled);
  });
  
  // Then override with options preferences
  optionsPrefs.forEach(pref => {
    prefMap.set(pref.id, pref.enabled);
  });
  
  // Convert back to array
  const preferences = Array.from(prefMap).map(([id, enabled]) => {
    const pref = mappedUserPrefs.find(p => p.id === id) || optionsPrefs.find(p => p.id === id);
    return {
      id,
      label: pref?.label || id,
      enabled
    };
  });
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
      let urls: { url: string; isPreferred: boolean; label: string }[] = [];
      
      // Check for routing preferences
      const avoidTolls = preferences.find(p => p.id === 'avoidTolls')?.enabled || false;
      const avoidMotorways = preferences.find(p => p.id === 'avoidMotorways')?.enabled || true;
      const avoidFerries = preferences.find(p => p.id === 'avoidFerries')?.enabled || false;
      const avoidUnpaved = preferences.find(p => p.id === 'avoidHighTraffic')?.enabled || false;
      
      // Default URL
      urls.push({ url: baseUrl, isPreferred: true, label: 'Default' });
      
      // Apply preferences
      if (avoidTolls) exclude.push('toll');
      
      // if (avoidFerries) exclude.push('ferry');

      if (avoidMotorways) exclude.push('motorway');

      if (avoidUnpaved) exclude.push('unpaved');
      
      // Add URL with exclusions if any
      if (exclude.length > 0) {
        const exclusionUrl = `${baseUrl}&exclude=${exclude.join(',')}`;
        urls.push({ 
          url: exclusionUrl, 
          isPreferred: Boolean(avoidTolls || avoidMotorways || avoidUnpaved), 
          label: `No ${exclude.join(' or ')}`
        });
      }
      
      // Fetch routes for all URLs
      const responses = await Promise.all(urls.map(({ url }) => fetch(url)));
      const dataResults = await Promise.all(
        responses.map(response => response.json() as Promise<MapboxDirectionsResponse>)
      );
      
      // Process results
      let allRoutes: Route[] = [];
      let mainRoute: Route | null = null;
      let altRoutes: Route[] = [];
      
      // Process all routes from different URL requests
      dataResults.forEach((data, index) => {
        if (!data.routes.length) return;
        
        const urlInfo = urls[index];
        
        // Add routes to pool, marking preferred ones
        data.routes.forEach(route => {
          // For routes with preferences, add a custom property
          if (urlInfo.isPreferred && !mainRoute) {
            route.weight_name = urlInfo.label.toLowerCase();
            mainRoute = route;
          } else {
            // Add to alternates, avoiding duplicates
            const isDuplicate = allRoutes.some(
              existingRoute => 
                JSON.stringify(existingRoute.geometry) === JSON.stringify(route.geometry)
            );
            
            if (!isDuplicate) {
              route.weight_name = urlInfo.label.toLowerCase();
              altRoutes.push(route);
              allRoutes.push(route);
            }
          }
        });
      });

      // If no routes found from any request
      if (!mainRoute && altRoutes.length === 0) {
        setError("No route found.");
        return;
      }
      
      // If we have a main route (from preferred options)
      if (mainRoute) {
        // console.log(mainRoute);
        setSelectedRoute(mainRoute);
        setAlternateRoutes(altRoutes);
      } else if (altRoutes.length > 0) {
        // If no main route but we have alternates
        setSelectedRoute(altRoutes[0]);
        setAlternateRoutes(altRoutes.slice(1));
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
