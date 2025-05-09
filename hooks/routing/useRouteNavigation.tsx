// hooks/routing/useRouteNavigation.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import * as turf from "@turf/turf";
import ttsManager from "@/utils/ttsManager";
import { Route, Step, VoiceInstruction } from "@/types/mapbox";
import { Coordinate } from "./utils/types";
import {
  findNearestPointOnRoute,
  calculateDistanceInMeters,
  hasArrivedAtDestination,
} from "./utils/routeAnalysis";
import {
  OFF_ROUTE_THRESHOLD,
  // ANNOUNCEMENT_DISTANCES, // No longer strictly needed for VI selection if using simpler logic
  OFF_ROUTE_CONFIRMATION_COUNT,
} from "./utils/constants";
// import { formatDistance } from "./utils/formatters"; // Only if fallback uses it

interface UseRouteNavigationOptions {
  onOffRoute?: (userLocation: Coordinate) => void;
  onArrive?: () => void;
}

export const useRouteNavigation = (
  selectedRoute: Route | null,
  options: UseRouteNavigationOptions = {}
) => {
  const { onOffRoute, onArrive } = options;

  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [liveUserLocation, setLiveUserLocation] = useState<Coordinate | null>(
    null
  );
  const [traveledCoords, setTraveledCoords] = useState<Coordinate[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  // const [currentInstruction, setCurrentInstruction] = useState<string>(""); // This will be replaced by displayedInstruction
  const [displayedInstruction, setDisplayedInstruction] = useState<string>(""); // NEW: For instruction card
  const [distanceToNextManeuver, setDistanceToNextManeuver] = useState<
    number | null
  >(null);
  const [announcementsMadeForStep, setAnnouncementsMadeForStep] = useState<
    Set<string>
  >(new Set());

  const [remainingDistance, setRemainingDistance] = useState<number>(0);
  const [remainingDuration, setRemainingDuration] = useState<number>(0);
  const [estimatedArrival, setEstimatedArrival] = useState<Date | null>(null);

  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null
  );
  const routeRef = useRef<Route | null>(null);
  const offRouteCountRef = useRef<number>(0);

  const speakInstruction = useCallback(
    (instruction: string, isManeuverChange: boolean = false) => {
      ttsManager.speak(instruction, isManeuverChange);
      setDisplayedInstruction(instruction); // NEW: Update displayed instruction when TTS speaks
    },
    []
  ); // setDisplayedInstruction is stable

  useEffect(() => {
    if (isNavigating && selectedRoute !== routeRef.current) {
      routeRef.current = selectedRoute;
      if (selectedRoute) {
        setCurrentStepIndex(0);
        setAnnouncementsMadeForStep(new Set());
        offRouteCountRef.current = 0;
        setTraveledCoords([]);
        setRemainingDistance(selectedRoute.distance);
        setRemainingDuration(selectedRoute.duration);
        setEstimatedArrival(
          new Date(Date.now() + selectedRoute.duration * 1000)
        );
        if (selectedRoute.legs[0]?.steps[0]) {
          const initialManeuverInstruction =
            selectedRoute.legs[0].steps[0].maneuver.instruction;
          // For the very first instruction, the maneuver text might be more appropriate for display
          // until the first voice instruction with distance is triggered.
          // Or, we can directly use a voice instruction if available for the start.
          // Let's prioritize voice instruction if the step has one at its beginning.
          let instructionToSpeakAndDisplay = initialManeuverInstruction;
          const firstStepVIs = selectedRoute.legs[0].steps[0].voiceInstructions;
          if (
            firstStepVIs &&
            firstStepVIs.length > 0 &&
            firstStepVIs[0].distanceAlongGeometry === 0
          ) {
            instructionToSpeakAndDisplay = firstStepVIs[0].announcement;
          }
          speakInstruction(instructionToSpeakAndDisplay, true);
        }
      }
    }
  }, [selectedRoute, isNavigating, speakInstruction]);

  const startLocationTracking = async () => {
    if (locationSubscription.current) locationSubscription.current.remove();
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,
        timeInterval: 1000,
      },
      (location) =>
        setLiveUserLocation([
          location.coords.longitude,
          location.coords.latitude,
        ])
    );
  };

  const updateTraveledRoute = (userLocation: Coordinate) => {
    setTraveledCoords((prev) => {
      const lastPoint = prev[prev.length - 1];
      if (
        lastPoint &&
        turf.distance(turf.point(lastPoint), turf.point(userLocation), {
          units: "meters",
        }) < 5
      )
        return prev;
      return [...prev, userLocation];
    });
  };

  const checkAndAnnounceVoiceInstructions = useCallback(
    (currentStep: Step, progressInCurrentStep: number) => {
      const voiceInstructions = currentStep.voiceInstructions || [];
      const sortedVIs = [...voiceInstructions].sort(
        (a, b) => a.distanceAlongGeometry - b.distanceAlongGeometry
      );

      for (const vi of sortedVIs) {
        const announcementKey = `${currentStepIndex}-${vi.announcement}`;
        if (announcementsMadeForStep.has(announcementKey)) continue;

        const ACTIVATION_BUFFER_METERS = 30;
        if (
          progressInCurrentStep >=
            vi.distanceAlongGeometry - ACTIVATION_BUFFER_METERS &&
          progressInCurrentStep < vi.distanceAlongGeometry + 10
        ) {
          console.log(
            `VI Activated: "${
              vi.announcement
            }". User at ${progressInCurrentStep.toFixed(
              0
            )}m in step. VI point at ${vi.distanceAlongGeometry.toFixed(0)}m.`
          );
          speakInstruction(vi.announcement); // This will also update displayedInstruction
          setAnnouncementsMadeForStep((prev) =>
            new Set(prev).add(announcementKey)
          );
          return;
        }
      }
    },
    [speakInstruction, announcementsMadeForStep, currentStepIndex]
  );

  const checkRouteProgress = useCallback(
    (userLocation: Coordinate) => {
      if (!selectedRoute || !isNavigating) return;
      updateTraveledRoute(userLocation);

      try {
        const currentLeg = selectedRoute.legs[0];
        if (!currentLeg) return;
        const steps = currentLeg.steps;
        if (!steps || steps.length === 0) return;

        const {
          distance: distanceFromRoute,
          location: progressAlongEntireRoute,
        } = findNearestPointOnRoute(selectedRoute, userLocation);

        if (distanceFromRoute > OFF_ROUTE_THRESHOLD) {
          offRouteCountRef.current += 1;
          if (offRouteCountRef.current >= (OFF_ROUTE_CONFIRMATION_COUNT || 3)) {
            offRouteCountRef.current = 0;
            if (onOffRoute) {
              // This is the crucial call
              console.log(
                `useRouteNavigation: User is off-route (distance: ${distanceFromRoute.toFixed(
                  0
                )}m). Calling onOffRoute callback.`
              );
              onOffRoute(userLocation); // This should trigger handleReroute in useRoute
            }
          }
          return; // Important: return here to avoid further processing if off-route
        } else {
          offRouteCountRef.current = 0;
        }

        let newStepIndex = currentStepIndex;
        let cumulativeDistanceAtStartOfCurrentStep = 0;
        for (let i = 0; i < steps.length; i++) {
          const stepDistance = steps[i].distance;
          if (
            progressAlongEntireRoute >=
              cumulativeDistanceAtStartOfCurrentStep &&
            progressAlongEntireRoute <
              cumulativeDistanceAtStartOfCurrentStep + stepDistance
          ) {
            newStepIndex = i;
            break;
          }
          cumulativeDistanceAtStartOfCurrentStep += stepDistance;
        }
        if (newStepIndex === steps.length) newStepIndex = steps.length - 1;

        if (newStepIndex !== currentStepIndex) {
          setCurrentStepIndex(newStepIndex);
          const newManeuverInstruction =
            steps[newStepIndex].maneuver.instruction;
          // When step changes, speak the maneuver instruction.
          // Voice instructions for this new step will be handled by checkAndAnnounceVoiceInstructions.
          speakInstruction(newManeuverInstruction, true);
          setAnnouncementsMadeForStep(new Set());
        }

        const currentStepObject = steps[newStepIndex];
        const progressInCurrentStep =
          progressAlongEntireRoute - cumulativeDistanceAtStartOfCurrentStep;

        if (newStepIndex < steps.length - 1) {
          const nextStepObject = steps[newStepIndex + 1];
          const nextManeuverLocation = nextStepObject.maneuver
            .location as Coordinate;
          const distToNextManeuverPoint = calculateDistanceInMeters(
            userLocation,
            nextManeuverLocation
          );
          setDistanceToNextManeuver(distToNextManeuverPoint);
          checkAndAnnounceVoiceInstructions(
            currentStepObject,
            progressInCurrentStep
          );
        } else {
          const destinationCoords = selectedRoute.geometry.coordinates[
            selectedRoute.geometry.coordinates.length - 1
          ] as Coordinate;
          const distanceToDestination = calculateDistanceInMeters(
            userLocation,
            destinationCoords
          );
          setDistanceToNextManeuver(distanceToDestination);
          if (hasArrivedAtDestination(selectedRoute, userLocation)) {
            speakInstruction("Vous êtes arrivé à destination", true);
            setIsNavigating(false);
            if (onArrive) onArrive();
          } else {
            checkAndAnnounceVoiceInstructions(
              currentStepObject,
              progressInCurrentStep
            );
          }
        }

        const updatedRemainingDistance = Math.max(
          0,
          selectedRoute.distance - progressAlongEntireRoute
        );
        const progressPercentage =
          selectedRoute.distance > 0
            ? progressAlongEntireRoute / selectedRoute.distance
            : 0;
        const updatedRemainingDuration =
          selectedRoute.duration * (1 - progressPercentage);
        setRemainingDistance(updatedRemainingDistance);
        setRemainingDuration(updatedRemainingDuration);
        setEstimatedArrival(
          new Date(Date.now() + updatedRemainingDuration * 1000)
        );
      } catch (err) {
        console.error("Error checking route progress:", err);
      }
    },
    [
      selectedRoute,
      isNavigating,
      currentStepIndex,
      onOffRoute,
      onArrive,
      speakInstruction,
      checkAndAnnounceVoiceInstructions,
    ]
  );

  useEffect(() => {
    if (isNavigating && liveUserLocation) {
      checkRouteProgress(liveUserLocation);
    }
  }, [liveUserLocation, isNavigating, checkRouteProgress]);

  const updateNavigationMetrics = useCallback(
    (freshRoute: Route) => {
      if (!freshRoute || !selectedRoute || !liveUserLocation) return;
      const { location: progressAlongOldRoute } = findNearestPointOnRoute(
        selectedRoute,
        liveUserLocation
      );
      const progressPercentage =
        selectedRoute.distance > 0
          ? progressAlongOldRoute / selectedRoute.distance
          : 0;
      const freshRemainingDistance =
        freshRoute.distance * (1 - progressPercentage);
      const freshRemainingDuration =
        freshRoute.duration * (1 - progressPercentage);
      setRemainingDistance(Math.max(0, freshRemainingDistance));
      setRemainingDuration(Math.max(0, freshRemainingDuration));
      setEstimatedArrival(
        new Date(Date.now() + Math.max(0, freshRemainingDuration) * 1000)
      );
    },
    [selectedRoute, liveUserLocation]
  );

  const startNavigation = async () => {
    if (!selectedRoute) return;
    try {
      setIsNavigating(true);
      setTraveledCoords([]);
      setCurrentStepIndex(0);
      setAnnouncementsMadeForStep(new Set());
      offRouteCountRef.current = 0;
      setRemainingDistance(selectedRoute.distance);
      setRemainingDuration(selectedRoute.duration);
      setEstimatedArrival(new Date(Date.now() + selectedRoute.duration * 1000));
      if (selectedRoute.legs[0]?.steps[0]) {
        const initialManeuverInstruction =
          selectedRoute.legs[0].steps[0].maneuver.instruction;
        let instructionToSpeakAndDisplay = initialManeuverInstruction;
        const firstStepVIs = selectedRoute.legs[0].steps[0].voiceInstructions;
        if (
          firstStepVIs &&
          firstStepVIs.length > 0 &&
          firstStepVIs[0].distanceAlongGeometry === 0
        ) {
          instructionToSpeakAndDisplay = firstStepVIs[0].announcement;
        }
        speakInstruction(instructionToSpeakAndDisplay, true);
      }
      await startLocationTracking();
    } catch (err) {
      console.error("Error starting navigation:", err);
      setIsNavigating(false);
    }
  };

  const stopNavigation = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    ttsManager.stop();
    setIsNavigating(false);
    setDisplayedInstruction(""); // Clear displayed instruction on stop
  };

  useEffect(() => {
    return () => {
      if (locationSubscription.current) locationSubscription.current.remove();
      ttsManager.stop();
    };
  }, []);

  return {
    isNavigating,
    setIsNavigating,
    liveUserLocation,
    traveledCoords,
    // currentInstruction, // No longer explicitly needed if displayedInstruction is used
    displayedInstruction, // NEW: Expose this
    distanceToNextManeuver,
    currentStepIndex,
    remainingDistance,
    remainingDuration,
    estimatedArrival,
    startNavigation,
    stopNavigation,
    updateNavigationMetrics,
  };
};
