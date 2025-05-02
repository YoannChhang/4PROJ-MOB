import React, { useState, useEffect, useRef } from "react";
import { Platform } from "react-native";
import MapboxGL from "@rnmapbox/maps";
import Tts from "react-native-tts";
import { MapboxDirectionsResponse, Route, Step } from "@/types/mapbox";
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
  currentStepIndex: number;
  distanceToNextManeuver: number | null;
  setIsNavigating: React.Dispatch<React.SetStateAction<boolean>>;
}

// Distance threshold in meters to decide if user is close to a maneuver point
const MANEUVER_THRESHOLD = 30;
// Maximum allowed deviation from route before recalculation
const MAX_DEVIATION_DISTANCE = 50;
// Minimum distance between voice instructions to avoid repetition
const MIN_INSTRUCTION_DISTANCE = 100;

const useRoute = (
  origin: GeoJSON.Position | null,
  destination: GeoJSON.Position | null
): RouteHookReturn => {
  // Get user data and preferences from context
  const { userData } = useUser();

  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [alternateRoutes, setAlternateRoutes] = useState<Route[]>([]);
  const [routeExcludes, setRouteExcludes] = useState<string[] | undefined>(
    undefined
  );

  const [traveledCoords, setTraveledCoords] = useState<GeoJSON.Position[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [liveUserLocation, setUserLocation] = useState<GeoJSON.Position | null>(
    null
  );
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [currentInstruction, setCurrentInstruction] = useState<string>("");
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [distanceToNextManeuver, setDistanceToNextManeuver] = useState<
    number | null
  >(null);

  // Ref to track last spoken instruction to avoid repetition
  const lastSpokenInstruction = useRef<string>("");
  const lastInstructionLocation = useRef<GeoJSON.Position | null>(null);

  // Initialize TTS
  useEffect(() => {
    Tts.setDefaultLanguage("fr-FR");
    Tts.setDefaultRate(0.5);

    // Clean up
    return () => {
      Tts.stop();
    };
  }, []);

  const chooseRoute = (newRoute: Route, prevSelectedRoute: Route | null) => {
    console.log(
      `Selecting new route with duration: ${newRoute.duration} seconds`
    );

    if (!prevSelectedRoute) {
      setSelectedRoute(newRoute);
      return;
    }

    setSelectedRoute(newRoute);
    setAlternateRoutes((prev) => [
      prevSelectedRoute,
      ...prev.filter((r) => r !== newRoute),
    ]);

    // Reset navigation state when changing routes
    setCurrentStepIndex(0);
    setTraveledCoords([]);
    setCurrentInstruction("");
  };

  // Calculate distance between two points in meters
  const calculateDistance = (
    point1: GeoJSON.Position,
    point2: GeoJSON.Position
  ): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (point1[1] * Math.PI) / 180;
    const φ2 = (point2[1] * Math.PI) / 180;
    const Δφ = ((point2[1] - point1[1]) * Math.PI) / 180;
    const Δλ = ((point2[0] - point1[0]) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Find nearest point on route to user location
  const findNearestPointOnRoute = (
    userLocation: GeoJSON.Position,
    routeCoords: GeoJSON.Position[]
  ): { point: GeoJSON.Position; index: number; distance: number } => {
    let minDistance = Infinity;
    let nearestPoint = routeCoords[0];
    let nearestIndex = 0;

    routeCoords.forEach((point, index) => {
      const distance = calculateDistance(userLocation, point);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
        nearestIndex = index;
      }
    });

    return {
      point: nearestPoint,
      index: nearestIndex,
      distance: minDistance,
    };
  };

  // Find the current leg and step based on user's position on route
  const findCurrentStep = (
    routeCoords: GeoJSON.Position[],
    nearestPointIndex: number,
    steps: Step[]
  ): { step: Step | null; index: number } => {
    if (!steps || steps.length === 0) {
      return { step: null, index: 0 };
    }

    // Map each step to its starting index in the route coordinates
    const stepStartIndices = steps.map((step) => {
      const firstStepCoord = step.geometry.coordinates[0];

      // Find this coordinate in the main route
      return routeCoords.findIndex(
        (coord) =>
          Math.abs(coord[0] - firstStepCoord[0]) < 0.00001 &&
          Math.abs(coord[1] - firstStepCoord[1]) < 0.00001
      );
    });

    // Find the last step whose start index is less than or equal to our position
    let currentStepIndex = 0;
    for (let i = 0; i < stepStartIndices.length; i++) {
      if (stepStartIndices[i] <= nearestPointIndex) {
        currentStepIndex = i;
      } else {
        break;
      }
    }

    return {
      step: steps[currentStepIndex],
      index: currentStepIndex,
    };
  };

  // Speak instruction if not already spoken
  const speakInstruction = (
    instruction: string,
    userLocation: GeoJSON.Position
  ) => {
    if (!instruction) return;

    // Skip if this is the same instruction and we haven't moved far
    if (
      instruction === lastSpokenInstruction.current &&
      lastInstructionLocation.current &&
      calculateDistance(userLocation, lastInstructionLocation.current) <
        MIN_INSTRUCTION_DISTANCE
    ) {
      return;
    }

    // Stop any current speech and speak the new instruction
    Tts.stop();
    Tts.speak(instruction);

    // Update refs
    lastSpokenInstruction.current = instruction;
    lastInstructionLocation.current = userLocation;
  };

  const fetchRoute = async (start: GeoJSON.Position, end: GeoJSON.Position) => {
    if (!start || !end) {
      console.error("Missing start or end coordinates for route");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("Fetching route from", start, "to", end);

      // Prepare URL for Mapbox Directions API
      const baseUrl = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${start.join(
        ","
      )};${end.join(
        ","
      )}?geometries=geojson&overview=full&alternatives=true&steps=true&language=fr&banner_instructions=true&voice_instructions=true&voice_units=metric&access_token=${
        Config.MAPBOX_PK
      }`;

      // Build exclude parameters based on QR code or user preferences
      let exclude: string[] = [];

      if (routeExcludes && routeExcludes.length > 0) {
        // Use QR code excludes directly
        exclude = [...routeExcludes];
        console.log("Using QR code excludes:", exclude);
      } else {
        // Otherwise, use user preferences
        const avoidTolls = userData?.preferences?.avoid_tolls || false;
        const avoidHighways = userData?.preferences?.avoid_highways || false;
        const avoidUnpaved = userData?.preferences?.avoid_unpaved || false;

        if (avoidTolls) exclude.push("toll");
        if (avoidHighways) exclude.push("motorway");
        if (avoidUnpaved) exclude.push("unpaved");
      }

      // Build URLs for different routing options
      let urls: { url: string; label: string }[] = [];

      // Main URL with user's preferred exclusions
      if (exclude.length > 0) {
        urls.push({
          url: `${baseUrl}&exclude=${exclude.join(",")}`,
          label: `Default`,
        });
      } else {
        urls.push({
          url: baseUrl,
          label: `Default`,
        });
      }

      // Always add alternative routes with different options
      urls.push({
        url: `${baseUrl}&exclude=motorway`,
        label: `No highways`,
      });

      urls.push({
        url: `${baseUrl}&exclude=toll`,
        label: `No tolls`,
      });

      urls.push({
        url: `${baseUrl}&exclude=unpaved`,
        label: `No unpaved`,
      });

      // Fetch all routes in parallel
      const responses = await Promise.all(urls.map(({ url }) => fetch(url)));
      const dataResults = await Promise.all(
        responses.map(
          (response) => response.json() as Promise<MapboxDirectionsResponse>
        )
      );

      const defaultRouteResponse = dataResults.shift();

      // Process main routes
      let allRoutes: Route[] =
        defaultRouteResponse?.routes.map((route) => {
          return { ...route, is_prefered: true, weight_name: "" };
        }) ?? [];

      // Process alternative routes
      dataResults.forEach((data, index) => {
        if (!data.routes.length) return;

        const urlInfo = urls[index + 1];

        data.routes.forEach((route) => {
          // Check if this route is identical to any existing route
          const foundIndex = allRoutes.findIndex(
            (existingRoute) =>
              JSON.stringify(existingRoute.geometry) ===
              JSON.stringify(route.geometry)
          );

          if (foundIndex === -1) {
            // Add as new route
            route.weight_name = urlInfo.label;
            route.is_prefered = false;
            allRoutes.push(route);
          } else {
            // Update existing route with additional info
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

      // Sort routes by preference and then by weight
      allRoutes.sort((a, b) => {
        if (a.is_prefered !== b.is_prefered) {
          return a.is_prefered ? -1 : 1;
        }
        return a.weight - b.weight;
      });

      if (allRoutes.length === 0) {
        setError("No route found.");
        return;
      }

      // Set routes
      setSelectedRoute(allRoutes[0]);
      setAlternateRoutes(allRoutes.slice(1));
      setTraveledCoords([]);
      setCurrentStepIndex(0);

      // Set initial instruction from first step if available
      if (allRoutes[0]?.legs?.[0]?.steps?.[0]?.maneuver?.instruction) {
        setCurrentInstruction(
          allRoutes[0].legs[0].steps[0].maneuver.instruction
        );
      }
    } catch (err) {
      console.error("Error in fetchRoute:", err);
      setError("Failed to fetch route.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch route when origin or destination changes
  useEffect(() => {
    if (origin && destination) {
      fetchRoute(origin, destination);
    }
  }, [origin, destination, routeExcludes]);

  // Handle navigation tracking
  useEffect(() => {
    if (!isNavigating || !selectedRoute) return;

    // Set up location tracking
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

      if (!selectedRoute?.geometry?.coordinates?.length) return;

      // Find the closest point on the route
      const {
        point: nearestPoint,
        index: nearestPointIndex,
        distance: distanceFromRoute,
      } = findNearestPointOnRoute(
        currentLocation,
        selectedRoute.geometry.coordinates
      );

      // Check if we're still on route
      if (distanceFromRoute > MAX_DEVIATION_DISTANCE) {
        console.log("User deviated from route, recalculating...");
        fetchRoute(currentLocation, destination!);
        return;
      }

      // Update traveled coordinates
      const newTraveledCoords = selectedRoute.geometry.coordinates.slice(
        0,
        nearestPointIndex + 1
      );
      setTraveledCoords(newTraveledCoords);

      // Find current step and update instruction
      if (selectedRoute.legs && selectedRoute.legs.length > 0) {
        const currentLeg = selectedRoute.legs[0];

        if (currentLeg.steps && currentLeg.steps.length > 0) {
          const { step, index } = findCurrentStep(
            selectedRoute.geometry.coordinates,
            nearestPointIndex,
            currentLeg.steps
          );

          if (step && index !== currentStepIndex) {
            setCurrentStepIndex(index);

            // Update instruction
            const instruction =
              step.maneuver?.instruction || "Continue straight";
            setCurrentInstruction(instruction);

            // Speak the instruction
            speakInstruction(instruction, currentLocation);
          }

          // Calculate distance to next maneuver
          if (index < currentLeg.steps.length - 1) {
            const nextStep = currentLeg.steps[index + 1];
            const nextManeuverPoint = nextStep.geometry.coordinates[0];
            const distance = calculateDistance(
              currentLocation,
              nextManeuverPoint
            );
            setDistanceToNextManeuver(distance);

            // Speak approaching instruction when close
            if (
              distance < MANEUVER_THRESHOLD * 3 &&
              nextStep.maneuver?.instruction
            ) {
              const approachingInstruction = `In ${Math.round(
                distance
              )} meters, ${nextStep.maneuver.instruction}`;
              speakInstruction(approachingInstruction, currentLocation);
            }
          } else {
            // Approaching destination
            const destinationPoint =
              selectedRoute.geometry.coordinates[
                selectedRoute.geometry.coordinates.length - 1
              ];
            const distance = calculateDistance(
              currentLocation,
              destinationPoint
            );
            setDistanceToNextManeuver(distance);

            if (
              distance < MANEUVER_THRESHOLD &&
              lastSpokenInstruction.current !== "Arriving at destination"
            ) {
              speakInstruction("Arriving at destination", currentLocation);
            }
          }
        }
      }
    };

    // Start location tracking
    const trackUserLocation = async () => {
      try {
        await MapboxGL.locationManager.start();
        MapboxGL.locationManager.addListener(handleLocationUpdate);
      } catch (error) {
        console.error("Error starting location tracking:", error);
      }
    };

    trackUserLocation();

    // Clean up
    return () => {
      MapboxGL.locationManager.removeListener(handleLocationUpdate);
    };
  }, [isNavigating, selectedRoute, destination, currentStepIndex]);

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
      setCurrentStepIndex(0);

      // Set and speak initial instruction
      if (selectedRoute?.legs?.[0]?.steps?.[0]?.maneuver?.instruction) {
        const initialInstruction =
          selectedRoute.legs[0].steps[0].maneuver.instruction;
        setCurrentInstruction(initialInstruction);
        speakInstruction(
          `Starting navigation. ${initialInstruction}`,
          origin || [0, 0]
        );
      } else {
        setCurrentInstruction("Starting navigation");
        speakInstruction("Starting navigation", origin || [0, 0]);
      }
    },
    stopNavigation: () => {
      setIsNavigating(false);
      Tts.stop();
      lastSpokenInstruction.current = "";
      lastInstructionLocation.current = null;
    },
    currentInstruction,
    setRouteExcludes,
    currentStepIndex,
    distanceToNextManeuver,
    setIsNavigating,
  };
};

export default useRoute;
