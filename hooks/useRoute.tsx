import { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as Location from "expo-location";
import * as turf from "@turf/turf";
import Tts from "react-native-tts";
import {
  MapboxDirectionsResponse,
  Route,
  Step,
  VoiceInstruction,
} from "@/types/mapbox";
import { useUser } from "@/providers/UserProvider";
import Config from "react-native-config";

// Mapbox API access token
const MAPBOX_ACCESS_TOKEN = Config.MAPBOX_PK as string;

// Distance threshold in meters to consider if user is off-route
const OFF_ROUTE_THRESHOLD = 50;
// Distance to announce next maneuver (in meters)
const ANNOUNCEMENT_DISTANCES = [1000, 500, 200, 100, 50];
// Minimum distance (in meters) between route calculation attempts
const RECALCULATION_DISTANCE_THRESHOLD = 10;
// Minimum time (in ms) between route calculation attempts
const RECALCULATION_TIME_THRESHOLD = 10000;

// Route feature detection
interface RouteFeatures {
  hasHighways: boolean;
  hasTolls: boolean;
  hasUnpavedRoads: boolean;
  estimatedTime: string; // formatted time
  distance: string; // formatted distance
  trafficLevel: "low" | "moderate" | "heavy" | "severe" | "unknown";
}

/**
 * Custom hook for routing functionality with enhanced traffic and route features
 * @param origin Starting point [longitude, latitude]
 * @param destination Ending point [longitude, latitude]
 * @returns Routing state and functions
 */
export default function useRoute(
  origin: [number, number] | null,
  destination: [number, number] | null
) {
  // Get user preferences
  const { userData } = useUser();

  // Core routing state
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [alternateRoutes, setAlternateRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Route features state
  const [routeFeatures, setRouteFeatures] = useState<
    Record<string, RouteFeatures>
  >({});

  // Navigation state
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [liveUserLocation, setLiveUserLocation] = useState<
    [number, number] | null
  >(null);
  const [traveledCoords, setTraveledCoords] = useState<[number, number][]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [currentInstruction, setCurrentInstruction] = useState<string>("");
  const [distanceToNextManeuver, setDistanceToNextManeuver] = useState<
    number | null
  >(null);
  const [announcementsMade, setAnnouncementsMade] = useState<Set<number>>(
    new Set()
  );

  // Rerouting state
  const [routeExcludes, setRouteExcludes] = useState<string[] | undefined>(
    undefined
  );
  const [isRerouting, setIsRerouting] = useState<boolean>(false);
  const lastRerouteLocation = useRef<[number, number] | null>(null);
  const lastRerouteTime = useRef<number>(0);
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null
  );

  // Advanced detection state
  const featureDetectionComplete = useRef<boolean>(false);

  // Set up Text-to-Speech
  useEffect(() => {
    const initTts = async () => {
      try {
        await Tts.getInitStatus();
        Tts.setDefaultLanguage("fr-FR");
        Tts.setDefaultRate(0.5);
      } catch (err) {
        console.error("Failed to initialize TTS:", err);
      }
    };

    initTts();

    return () => {
      // Clean up TTS when component unmounts
      Tts.stop();
    };
  }, []);

  // Parse user preferences into route excludes
  useEffect(() => {
    if (!userData?.preferences) return;

    const excludes: string[] = [];
    if (userData.preferences.avoid_tolls) excludes.push("toll");
    if (userData.preferences.avoid_highways) excludes.push("motorway");
    if (userData.preferences.avoid_unpaved) excludes.push("unpaved");

    setRouteExcludes(excludes.length > 0 ? excludes : undefined);
  }, [userData?.preferences]);

  /**
   * Format duration for display
   * @param seconds Duration in seconds
   * @returns Formatted string (e.g. "1h 30min")
   */
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  /**
   * Format distance for display
   * @param meters Distance in meters
   * @returns Formatted string (e.g. "10.5 km")
   */
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  /**
   * Analyze traffic level from route congestion data
   */
  const analyzeTrafficLevel = (
    route: Route
  ): "low" | "moderate" | "heavy" | "severe" | "unknown" => {
    // Track congestion level counts
    let congestionLevels: Record<string, number> = {
      low: 0,
      moderate: 0,
      heavy: 0,
      severe: 0,
      unknown: 0,
    };

    // Count occurrences of each congestion level
    let totalSegments = 0;

    route.legs.forEach((leg) => {
      leg.steps.forEach((step) => {
        if (step.annotation && step.annotation.congestion) {
          step.annotation.congestion.forEach((level: string) => {
            if (level in congestionLevels) {
              congestionLevels[level]++;
            } else {
              congestionLevels["unknown"]++;
            }
            totalSegments++;
          });
        }
      });
    });

    if (totalSegments === 0) {
      return "unknown";
    }

    // Calculate percentages
    const heavyPercent =
      ((congestionLevels["heavy"] + congestionLevels["severe"]) /
        totalSegments) *
      100;
    const moderatePercent =
      (congestionLevels["moderate"] / totalSegments) * 100;

    // Determine dominant traffic level
    if (heavyPercent > 20) {
      return "heavy";
    } else if (moderatePercent > 30 || heavyPercent > 10) {
      return "moderate";
    } else {
      return "low";
    }
  };

  /**
   * Initialize basic route features
   */
  const initializeRouteFeatures = (
    routes: Route[]
  ): Record<string, RouteFeatures> => {
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

    return features;
  };

  /**
   * Helper function to fetch routes with specific exclusions
   */
  const fetchRoute = async (
    originPoint: [number, number],
    destinationPoint: [number, number],
    excludes: string[]
  ): Promise<MapboxDirectionsResponse> => {
    // Always use driving-traffic for real-time traffic conditions
    const profile = "driving-traffic";

    // Format the request URL with optional exclude parameters
    let url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${originPoint[0]},${originPoint[1]};${destinationPoint[0]},${destinationPoint[1]}`;

    // Add query parameters
    const params = new URLSearchParams({
      access_token: MAPBOX_ACCESS_TOKEN,
      alternatives: "true",
      geometries: "geojson",
      overview: "full",
      steps: "true",
      voice_instructions: "true",
      voice_units: "metric",
      language: "fr",
      annotations: "duration,distance,speed,congestion",
    });

    // Add exclude parameters if needed
    if (excludes && excludes.length > 0) {
      params.append("exclude", excludes.join(","));
    }

    url += `?${params.toString()}`;

    const response = await axios.get<MapboxDirectionsResponse>(url);
    return response.data;
  };

  /**
   * Calculate path similarity between two routes
   * Returns a value between 0 (completely different) and 1 (identical)
   */
  const calculatePathSimilarity = (routeA: Route, routeB: Route): number => {
    try {
      // Create line strings from route geometries
      const lineA = turf.lineString(routeA.geometry.coordinates);
      const lineB = turf.lineString(routeB.geometry.coordinates);

      // Use Turf.js to calculate bounding box of both routes
      const boundsA = turf.bbox(lineA);
      const boundsB = turf.bbox(lineB);

      // Calculate overlap of bounding boxes
      const overlapArea = calculateBoundsOverlap(boundsA, boundsB);

      // Calculate total area
      const areaA = (boundsA[2] - boundsA[0]) * (boundsA[3] - boundsA[1]);
      const areaB = (boundsB[2] - boundsB[0]) * (boundsB[3] - boundsB[1]);
      const maxArea = Math.max(areaA, areaB);

      // Calculate overlap ratio
      const overlapRatio = overlapArea / maxArea;

      // Also consider path length similarity
      const lengthA = turf.length(lineA);
      const lengthB = turf.length(lineB);
      const lengthRatio =
        Math.min(lengthA, lengthB) / Math.max(lengthA, lengthB);

      // Combine metrics (weighted average)
      return overlapRatio * 0.7 + lengthRatio * 0.3;
    } catch (error) {
      console.error("Error calculating path similarity:", error);
      return 0.5; // Default to moderate similarity on error
    }
  };

  /**
   * Calculate the overlap area of two bounding boxes
   */
  const calculateBoundsOverlap = (
    boundsA: number[],
    boundsB: number[]
  ): number => {
    // Check if the bounding boxes overlap
    const xOverlap = Math.max(
      0,
      Math.min(boundsA[2], boundsB[2]) - Math.max(boundsA[0], boundsB[0])
    );
    const yOverlap = Math.max(
      0,
      Math.min(boundsA[3], boundsB[3]) - Math.max(boundsA[1], boundsB[1])
    );

    // Return the area of overlap
    return xOverlap * yOverlap;
  };

  /**
   * Enhanced feature detection using Mapbox API with different exclusions
   */
  const detectRouteFeatures = async (
    originPoint: [number, number],
    destinationPoint: [number, number],
    initialRoutes: Route[]
  ): Promise<void> => {
    if (!originPoint || !destinationPoint || !initialRoutes.length) {
      return;
    }

    try {
      // Initialize basic features
      const features = initializeRouteFeatures(initialRoutes);
      setRouteFeatures(features);

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
        {
          excludes: ["motorway", "toll", "unpaved"],
          features: ["hasHighways", "hasTolls", "hasUnpavedRoads"],
        },
      ];

      // Fetch baseline route with no exclusions
      const baselineResponse = await fetchRoute(
        originPoint,
        destinationPoint,
        []
      );
      const baselineRoute = baselineResponse.routes[0];

      // For each exclusion combination, fetch routes and compare
      const exclusionResults = await Promise.all(
        exclusionCombinations.map((combo) =>
          fetchRoute(originPoint, destinationPoint, combo.excludes)
        )
      );

      // Analyze results for each initial route
      initialRoutes.forEach((route, routeIndex) => {
        const routeId =
          routeIndex === 0 ? "primary" : `alternate-${routeIndex - 1}`;
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
            // @ts-ignore
            updateFeatures[combo.feature] = hasFeature;
          } else if (combo.features) {
            // Multiple feature exclusion - if there's a significant difference,
            // check which individual features are most likely present
            if (hasFeature) {
              // Look at individual exclusion results for more precise detection
              combo.features.forEach((feature, idx) => {
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
                    // @ts-ignore
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
    }
  };

  // Fetch routes when origin or destination changes
  useEffect(() => {
    const fetchRoutesWithFeatureDetection = async () => {
      if (!origin || !destination) {
        return;
      }

      setLoading(true);
      setError(null);
      featureDetectionComplete.current = false;

      try {
        // Always use driving-traffic for real-time traffic conditions
        const profile = "driving-traffic";

        // Format the request URL with optional exclude parameters
        let url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;

        // Add query parameters
        const params = new URLSearchParams({
          access_token: MAPBOX_ACCESS_TOKEN,
          alternatives: "true",
          geometries: "geojson",
          overview: "full",
          steps: "true",
          voice_instructions: "true",
          voice_units: "metric",
          language: "fr",
          annotations: "duration,distance,speed,congestion",
        });

        // Add exclude parameters if needed
        if (routeExcludes && routeExcludes.length > 0) {
          params.append("exclude", routeExcludes.join(","));
        }

        url += `?${params.toString()}`;

        const response = await axios.get<MapboxDirectionsResponse>(url);

        if (response.data.routes.length > 0) {
          const primaryRoute = response.data.routes[0];
          const otherRoutes = response.data.routes.slice(1);

          // Set initial routes and basic features
          setSelectedRoute(primaryRoute);
          setAlternateRoutes(otherRoutes);

          // Initialize basic features
          const initialFeatures = initializeRouteFeatures([
            primaryRoute,
            ...otherRoutes,
          ]);
          setRouteFeatures(initialFeatures);

          // Reset navigation state
          setCurrentStepIndex(0);
          setTraveledCoords([]);
          setAnnouncementsMade(new Set());

          // Set initial instruction
          if (primaryRoute.legs[0]?.steps[0]) {
            setCurrentInstruction(
              primaryRoute.legs[0].steps[0].maneuver.instruction
            );
          }

          // Start advanced feature detection in background
          detectRouteFeatures(origin, destination, [
            primaryRoute,
            ...otherRoutes,
          ]);
        } else {
          setError("No routes found");
        }
      } catch (err) {
        console.error("Error fetching routes:", err);
        setError("Failed to fetch routes");
        featureDetectionComplete.current = true;
      } finally {
        setLoading(false);
      }
    };

    fetchRoutesWithFeatureDetection();
  }, [origin, destination, routeExcludes]);

  // Start user location tracking for navigation
  const startLocationTracking = async () => {
    // Clear any existing subscription
    if (locationSubscription.current) {
      locationSubscription.current.remove();
    }

    // Start a new subscription
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5, // Update every 5 meters
        timeInterval: 1000, // Or at least every 1 second
      },
      (location) => {
        const coords: [number, number] = [
          location.coords.longitude,
          location.coords.latitude,
        ];

        setLiveUserLocation(coords);

        // Update traveled coordinates for the route line
        if (isNavigating && selectedRoute) {
          updateTraveledRoute(coords);
        }
      }
    );
  };

  // Update the traveled portion of the route
  const updateTraveledRoute = (userLocation: [number, number]) => {
    if (!selectedRoute || !isNavigating) return;

    // Add user location to traveled coordinates
    setTraveledCoords((prev) => {
      // Check if the user has moved significantly from the last point
      const lastPoint = prev[prev.length - 1];
      if (lastPoint) {
        const distance = turf.distance(
          turf.point(lastPoint),
          turf.point(userLocation),
          { units: "meters" }
        );

        // Only add the point if the user has moved at least 5 meters
        if (distance < 5) {
          return prev;
        }
      }

      return [...prev, userLocation];
    });

    // Check if user is on route
    checkRouteProgress(userLocation);
  };

  // Check user's progress along the route
  const checkRouteProgress = (userLocation: [number, number]) => {
    if (!selectedRoute || !isNavigating) return;

    try {
      // Get current leg (typically just one for simple routes)
      const currentLeg = selectedRoute.legs[0];
      if (!currentLeg) return;

      // Get all steps in the route
      const steps = currentLeg.steps;
      if (!steps || steps.length === 0) return;

      // Convert route line to a turf LineString
      const routeLine = turf.lineString(selectedRoute.geometry.coordinates);

      // Find the nearest point on the route line to the user's location
      const userPoint = turf.point(userLocation);
      const snapped = turf.nearestPointOnLine(routeLine, userPoint, {
        units: "meters",
      });

      // Calculate distance from user to the route
      const distanceFromRoute = snapped.properties.dist || Infinity;

      // Check if user is off route
      if (distanceFromRoute > OFF_ROUTE_THRESHOLD) {
        // Check if enough time and distance has passed since last reroute
        const shouldRecalculate = checkShouldRecalculate(userLocation);

        if (shouldRecalculate) {
          handleReroute(userLocation);
        }

        return;
      }

      // Find current step and maneuver
      // Get the index along the line (percentage from 0 to 1)
      const currentIndex = snapped.properties.index || 0;
      const location = snapped.properties.location || 0;

      // Find which step we're currently in
      let newStepIndex = currentStepIndex;
      let cumulativeDistance = 0;

      // Calculate progress through the route
      for (let i = 0; i < steps.length; i++) {
        const stepDistance = steps[i].distance;
        if (
          location >= cumulativeDistance &&
          location < cumulativeDistance + stepDistance
        ) {
          newStepIndex = i;
          break;
        }
        cumulativeDistance += stepDistance;
      }

      // Update step index if needed
      if (newStepIndex !== currentStepIndex) {
        setCurrentStepIndex(newStepIndex);

        // Announce the new instruction
        const newInstruction = steps[newStepIndex].maneuver.instruction;
        setCurrentInstruction(newInstruction);
        speakInstruction(newInstruction);

        // Reset announcements for the new step
        setAnnouncementsMade(new Set());
      }

      // Calculate distance to the next maneuver
      if (newStepIndex < steps.length - 1) {
        const nextManeuverCoords = steps[newStepIndex + 1].maneuver.location;
        const distance =
          turf.distance(
            turf.point(userLocation),
            turf.point(nextManeuverCoords),
            { units: "meters" }
          ) * 1000; // Convert km to meters

        setDistanceToNextManeuver(distance);

        // Check if we need to announce upcoming maneuver
        checkAnnouncementDistances(distance, steps[newStepIndex + 1]);
      } else {
        // We're on the last step, calculate distance to destination
        const destinationCoords =
          selectedRoute.geometry.coordinates[
            selectedRoute.geometry.coordinates.length - 1
          ];
        const distance =
          turf.distance(
            turf.point(userLocation),
            turf.point(destinationCoords),
            { units: "meters" }
          ) * 1000; // Convert km to meters

        setDistanceToNextManeuver(distance);

        // Check if we've arrived
        if (distance < 20) {
          speakInstruction("Vous êtes arrivé à destination");
          setIsNavigating(false);
        }
      }
    } catch (err) {
      console.error("Error checking route progress:", err);
    }
  };

  // Check if we should announce an upcoming maneuver
  const checkAnnouncementDistances = (distance: number, step: Step) => {
    // Find voice instructions for this step
    const voiceInstructions = step.voiceInstructions || [];

    // Check each announcement distance
    for (const threshold of ANNOUNCEMENT_DISTANCES) {
      // Only announce if we're within 5 meters of the threshold and haven't announced yet
      if (
        distance <= threshold + 5 &&
        distance >= threshold - 5 &&
        !announcementsMade.has(threshold)
      ) {
        // Find the appropriate voice instruction for this distance
        const instruction = findVoiceInstructionForDistance(
          voiceInstructions,
          distance
        );

        if (instruction) {
          speakInstruction(instruction.announcement);

          // Mark this announcement as made
          setAnnouncementsMade((prev) => {
            const newSet = new Set(prev);
            newSet.add(threshold);
            return newSet;
          });
        }
      }
    }
  };

  // Find the appropriate voice instruction for a given distance
  const findVoiceInstructionForDistance = (
    instructions: VoiceInstruction[],
    currentDistance: number
  ): VoiceInstruction | undefined => {
    // Sort instructions by distance (descending)
    const sortedInstructions = [...instructions].sort(
      (a, b) => b.distanceAlongGeometry - a.distanceAlongGeometry
    );

    // Find the first instruction with a distance less than the current distance
    return sortedInstructions.find(
      (instruction) => instruction.distanceAlongGeometry <= currentDistance + 10
    );
  };

  // Speak an instruction using TTS
  const speakInstruction = (instruction: string) => {
    // Stop any currently speaking instruction
    Tts.stop();

    // Speak the new instruction
    Tts.speak(instruction);
  };

  // Check if we should recalculate the route
  const checkShouldRecalculate = (userLocation: [number, number]): boolean => {
    const now = Date.now();

    // If we're already rerouting, wait until it's done
    if (isRerouting) return false;

    // Check if enough time has passed since last reroute
    const timeSinceLastReroute = now - lastRerouteTime.current;
    if (timeSinceLastReroute < RECALCULATION_TIME_THRESHOLD) return false;

    // Check if we've moved enough since last reroute
    if (lastRerouteLocation.current) {
      const distanceSinceLastReroute = turf.distance(
        turf.point(userLocation),
        turf.point(lastRerouteLocation.current),
        { units: "meters" }
      );

      if (distanceSinceLastReroute < RECALCULATION_DISTANCE_THRESHOLD)
        return false;
    }

    return true;
  };

  // Handle rerouting when user goes off course
  const handleReroute = async (userLocation: [number, number]) => {
    if (!destination || !isNavigating) return;

    setIsRerouting(true);
    lastRerouteLocation.current = userLocation;
    lastRerouteTime.current = Date.now();

    try {
      // Announce rerouting
      speakInstruction("Recalcul d'itinéraire en cours");

      // Always use driving-traffic for real-time traffic conditions
      const profile = "driving-traffic";

      // Construct the URL for the Mapbox Directions API
      let url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${userLocation[0]},${userLocation[1]};${destination[0]},${destination[1]}`;

      // Add query parameters
      const params = new URLSearchParams({
        access_token: MAPBOX_ACCESS_TOKEN,
        alternatives: "false", // Only need main route for recalculation
        geometries: "geojson",
        overview: "full",
        steps: "true",
        voice_instructions: "true",
        voice_units: "metric",
        language: "fr",
        annotations: "duration,distance,speed,congestion",
      });

      // Add exclude parameters if needed
      if (routeExcludes && routeExcludes.length > 0) {
        params.append("exclude", routeExcludes.join(","));
      }

      url += `?${params.toString()}`;

      const response = await axios.get<MapboxDirectionsResponse>(url);

      if (response.data.routes.length > 0) {
        const newRoute = response.data.routes[0];

        // Extract basic features for the new route
        const basicFeatures = initializeRouteFeatures([newRoute]);
        setRouteFeatures(basicFeatures);

        // Update the route
        setSelectedRoute(newRoute);
        setAlternateRoutes([]);

        // Reset navigation state
        setCurrentStepIndex(0);
        setTraveledCoords([userLocation]);
        setAnnouncementsMade(new Set());

        // Set initial instruction
        if (newRoute.legs[0]?.steps[0]) {
          const newInstruction = newRoute.legs[0].steps[0].maneuver.instruction;
          setCurrentInstruction(newInstruction);
          speakInstruction("Nouvel itinéraire. " + newInstruction);
        }

        // Start advanced feature detection in background
        detectRouteFeatures(userLocation, destination, [newRoute]);
      }
    } catch (err) {
      console.error("Error during rerouting:", err);
      // Continue with existing route
    } finally {
      setIsRerouting(false);
    }
  };

  // Start navigation mode
  const startNavigation = async () => {
    if (!selectedRoute) return;

    try {
      // Set navigation mode
      setIsNavigating(true);

      // Reset navigation state
      setTraveledCoords([]);
      setCurrentStepIndex(0);
      setAnnouncementsMade(new Set());

      // Set initial instruction
      if (selectedRoute.legs[0]?.steps[0]) {
        const instruction = selectedRoute.legs[0].steps[0].maneuver.instruction;
        setCurrentInstruction(instruction);
        speakInstruction(instruction);
      }

      // Start location tracking
      await startLocationTracking();
    } catch (err) {
      console.error("Error starting navigation:", err);
      setIsNavigating(false);
    }
  };

  // Stop navigation mode
  const stopNavigation = () => {
    // Stop location tracking
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    // Stop TTS
    Tts.stop();

    // Reset navigation state
    setIsNavigating(false);
    setTraveledCoords([]);
    setCurrentStepIndex(0);
    setCurrentInstruction("");
    setDistanceToNextManeuver(null);
    setAnnouncementsMade(new Set());
  };

  // Change routes (e.g., user selects an alternate route)
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

    // Reset navigation state
    setCurrentStepIndex(0);
    setTraveledCoords([]);
    setAnnouncementsMade(new Set());

    // Set initial instruction
    if (route.legs[0]?.steps[0]) {
      setCurrentInstruction(route.legs[0].steps[0].maneuver.instruction);
    }
  };

  // Get features for a specific route
  const getRouteFeatures = (routeId: string): RouteFeatures | undefined => {
    return routeFeatures[routeId];
  };

  // Check if feature detection is still in progress
  const isFeatureDetectionInProgress = (): boolean => {
    return loading || !featureDetectionComplete.current;
  };

  // Clean up when the hook unmounts
  useEffect(() => {
    return () => {
      // Stop location tracking
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      // Stop TTS
      Tts.stop();
    };
  }, []);

  return {
    // Route state
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading,
    error,

    // Navigation state
    isNavigating,
    setIsNavigating,
    liveUserLocation,
    traveledCoords,
    currentInstruction,
    distanceToNextManeuver,

    // Route filtering
    routeExcludes,
    setRouteExcludes,

    // Route features
    routeFeatures,
    getRouteFeatures,
    isFeatureDetectionInProgress,

    // Actions
    startNavigation,
    stopNavigation,
    chooseRoute,
  };
}
