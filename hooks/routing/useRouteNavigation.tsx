// src/hooks/routing/useRouteNavigation.ts
import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import Tts from 'react-native-tts';
import { Route, Step, VoiceInstruction } from '@/types/mapbox';
import { 
  Coordinate, 
  NavigationState 
} from './utils/types';
import { 
  findNearestPointOnRoute, 
  calculateDistanceInMeters,
  hasArrivedAtDestination
} from './utils/routeAnalysis';
import { 
  DEFAULT_NAVIGATION_LANGUAGE, 
  DEFAULT_TTS_RATE,
  OFF_ROUTE_THRESHOLD,
  ANNOUNCEMENT_DISTANCES 
} from './utils/constants';

interface UseRouteNavigationOptions {
  onOffRoute?: (userLocation: Coordinate) => void;
  onArrive?: () => void;
  ttsLanguage?: string;
  ttsRate?: number;
}

/**
 * Hook for handling navigation logic
 * @param selectedRoute The currently selected route
 * @param options Navigation options
 * @returns Navigation state and functions
 */
export const useRouteNavigation = (
  selectedRoute: Route | null,
  options: UseRouteNavigationOptions = {}
) => {
  const {
    onOffRoute,
    onArrive,
    ttsLanguage = DEFAULT_NAVIGATION_LANGUAGE,
    ttsRate = DEFAULT_TTS_RATE
  } = options;

  // Navigation state
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [liveUserLocation, setLiveUserLocation] = useState<Coordinate | null>(null);
  const [traveledCoords, setTraveledCoords] = useState<Coordinate[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [currentInstruction, setCurrentInstruction] = useState<string>("");
  const [distanceToNextManeuver, setDistanceToNextManeuver] = useState<number | null>(null);
  const [announcementsMade, setAnnouncementsMade] = useState<Set<number>>(new Set());
  
  // Location tracking subscription
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Set up Text-to-Speech
  useEffect(() => {
    const initTts = async () => {
      try {
        await Tts.getInitStatus();
        Tts.setDefaultLanguage(ttsLanguage);
        Tts.setDefaultRate(ttsRate);
      } catch (err) {
        console.error("Failed to initialize TTS:", err);
      }
    };

    initTts();

    return () => {
      // Clean up TTS when component unmounts
      Tts.stop();
    };
  }, [ttsLanguage, ttsRate]);

  /**
   * Speak an instruction using TTS
   * @param instruction The text to speak
   */
  const speakInstruction = (instruction: string) => {
    // Stop any currently speaking instruction
    Tts.stop();

    // Speak the new instruction
    Tts.speak(instruction);
  };

  /**
   * Start user location tracking for navigation
   */
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
        const coords: Coordinate = [
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

  /**
   * Update the traveled portion of the route
   * @param userLocation Current user location
   */
  const updateTraveledRoute = (userLocation: Coordinate) => {
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

  /**
   * Check user's progress along the route
   * @param userLocation Current user location
   */
  const checkRouteProgress = (userLocation: Coordinate) => {
    if (!selectedRoute || !isNavigating) return;

    try {
      // Get current leg (typically just one for simple routes)
      const currentLeg = selectedRoute.legs[0];
      if (!currentLeg) return;

      // Get all steps in the route
      const steps = currentLeg.steps;
      if (!steps || steps.length === 0) return;

      // Find nearest point on route to user
      const { distance: distanceFromRoute, location } = findNearestPointOnRoute(
        selectedRoute, 
        userLocation
      );

      // Check if user is off route
      if (distanceFromRoute > OFF_ROUTE_THRESHOLD) {
        if (onOffRoute) {
          onOffRoute(userLocation);
        }
        return;
      }

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
        const distance = calculateDistanceInMeters(userLocation, nextManeuverCoords);

        setDistanceToNextManeuver(distance);

        // Check if we need to announce upcoming maneuver
        checkAnnouncementDistances(distance, steps[newStepIndex + 1]);
      } else {
        // We're on the last step, calculate distance to destination
        const destinationCoords =
          selectedRoute.geometry.coordinates[
            selectedRoute.geometry.coordinates.length - 1
          ];
        const distance = calculateDistanceInMeters(userLocation, destinationCoords);

        setDistanceToNextManeuver(distance);

        // Check if we've arrived
        if (hasArrivedAtDestination(selectedRoute, userLocation)) {
          speakInstruction("Vous êtes arrivé à destination");
          setIsNavigating(false);
          
          if (onArrive) {
            onArrive();
          }
        }
      }
    } catch (err) {
      console.error("Error checking route progress:", err);
    }
  };

  /**
   * Check if we should announce an upcoming maneuver
   * @param distance Distance to next maneuver in meters
   * @param step The current navigation step
   */
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

  /**
   * Find the appropriate voice instruction for a given distance
   * @param instructions Array of voice instructions
   * @param currentDistance Current distance to maneuver
   * @returns The appropriate voice instruction or undefined
   */
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

  /**
   * Start navigation mode
   */
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

  /**
   * Stop navigation mode
   */
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
    isNavigating,
    setIsNavigating,
    liveUserLocation,
    traveledCoords,
    currentInstruction,
    distanceToNextManeuver,
    currentStepIndex,
    startNavigation,
    stopNavigation,
    speakInstruction
  };
};