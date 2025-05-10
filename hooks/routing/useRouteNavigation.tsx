// hooks/routing/useRouteNavigation.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
// import * as turf from "@turf/turf"; // Only specific turf functions are used from routeAnalysis
import ttsManager from "@/utils/ttsManager";
import { Route, Step, VoiceInstruction } from "@/types/mapbox";
import { Coordinate } from "./utils/types";
import {
  findNearestPointOnRoute,
  calculateDistanceInMeters,
  hasArrivedAtDestination,
  getSlicedRouteGeometry, // <<< IMPORTED THE HELPER
} from "./utils/routeAnalysis";
import {
  OFF_ROUTE_THRESHOLD,
  OFF_ROUTE_CONFIRMATION_COUNT,
} from "./utils/constants";

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
  const [traveledCoords, setTraveledCoords] = useState<Coordinate[]>([]); // Will store the SNAPPED path
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [displayedInstruction, setDisplayedInstruction] = useState<string>("");
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
      setDisplayedInstruction(instruction);
    },
    [setDisplayedInstruction]
  );

  useEffect(() => {
    if (isNavigating && selectedRoute && selectedRoute !== routeRef.current) {
      console.log(
        "useRouteNavigation: selectedRoute changed during navigation. Resetting state."
      );
      routeRef.current = selectedRoute;
      setCurrentStepIndex(0);
      setAnnouncementsMadeForStep(new Set());
      offRouteCountRef.current = 0;
      setTraveledCoords(
        selectedRoute.geometry.coordinates.length > 0
          ? [selectedRoute.geometry.coordinates[0] as Coordinate]
          : []
      );
      setRemainingDistance(selectedRoute.distance);
      setRemainingDuration(selectedRoute.duration);
      setEstimatedArrival(new Date(Date.now() + selectedRoute.duration * 1000));
      if (selectedRoute.legs[0]?.steps[0]) {
        let instructionToSpeakAndDisplay =
          selectedRoute.legs[0].steps[0].maneuver.instruction;
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
    } else if (!selectedRoute) {
      routeRef.current = null;
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

  const checkAndAnnounceVoiceInstructions = useCallback(
    (currentStep: Step, progressInCurrentStep: number) => {
      const voiceInstructions = currentStep.voiceInstructions || [];
      const sortedVIs = [...voiceInstructions].sort(
        (a, b) => a.distanceAlongGeometry - b.distanceAlongGeometry
      );

      for (const vi of sortedVIs) {
        const announcementKey = `${currentStepIndex}-${vi.announcement}`;
        if (announcementsMadeForStep.has(announcementKey)) continue;

        const ACTIVATION_BUFFER_METERS = 30; // Speak when this close to the VI's designated point
        const VI_POINT_TOLERANCE_METERS = 10; // Allow speaking if slightly past the point

        if (
          progressInCurrentStep >=
            vi.distanceAlongGeometry - ACTIVATION_BUFFER_METERS &&
          progressInCurrentStep <
            vi.distanceAlongGeometry + VI_POINT_TOLERANCE_METERS
        ) {
          console.log(
            `VI Activated: "${
              vi.announcement
            }". User at ${progressInCurrentStep.toFixed(
              0
            )}m in step. VI point at ${vi.distanceAlongGeometry.toFixed(0)}m.`
          );
          speakInstruction(vi.announcement);
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
    (userLoc: Coordinate) => {
      if (!selectedRoute || !isNavigating) {
        // This case is handled by the useEffect watching liveUserLocation and isNavigating
        return;
      }

      try {
        const currentLeg = selectedRoute.legs[0];
        if (!currentLeg) return;
        const steps = currentLeg.steps;
        if (!steps || steps.length === 0) return;

        const {
          distance: distanceFromRoute,
          location: progressAlongEntireRouteMeters,
        } = findNearestPointOnRoute(selectedRoute, userLoc);

        // Update traveledCoords with the SNAPPED path
        if (progressAlongEntireRouteMeters >= 0) {
          const snappedTraveledPath = getSlicedRouteGeometry(
            selectedRoute,
            progressAlongEntireRouteMeters
          );
          if (snappedTraveledPath && snappedTraveledPath.length > 0) {
            setTraveledCoords(snappedTraveledPath);
          } else if (
            progressAlongEntireRouteMeters === 0 &&
            selectedRoute.geometry.coordinates.length > 0
          ) {
            setTraveledCoords([
              selectedRoute.geometry.coordinates[0] as Coordinate,
            ]);
          }
        } else {
          setTraveledCoords(
            selectedRoute.geometry.coordinates.length > 0
              ? [selectedRoute.geometry.coordinates[0] as Coordinate]
              : []
          );
        }

        if (distanceFromRoute > OFF_ROUTE_THRESHOLD) {
          offRouteCountRef.current += 1;
          if (offRouteCountRef.current >= (OFF_ROUTE_CONFIRMATION_COUNT || 3)) {
            offRouteCountRef.current = 0;
            if (onOffRoute) onOffRoute(userLoc);
          }
          return;
        } else {
          offRouteCountRef.current = 0;
        }

        let newStepIndex = currentStepIndex;
        let cumulativeDistanceAtStartOfNewStep = 0;
        for (let i = 0; i < steps.length; i++) {
          const stepDistance = steps[i].distance;
          if (
            progressAlongEntireRouteMeters >=
              cumulativeDistanceAtStartOfNewStep &&
            progressAlongEntireRouteMeters <
              cumulativeDistanceAtStartOfNewStep + stepDistance
          ) {
            newStepIndex = i;
            break;
          }
          cumulativeDistanceAtStartOfNewStep += stepDistance;
        }
        if (newStepIndex === steps.length && steps.length > 0)
          newStepIndex = steps.length - 1;

        if (newStepIndex !== currentStepIndex) {
          setCurrentStepIndex(newStepIndex);
          speakInstruction(steps[newStepIndex].maneuver.instruction, true);
          setAnnouncementsMadeForStep(new Set());
        }

        const currentStepObject = steps[newStepIndex];
        let finalCumulativeDistanceForActualCurrentStepStart = 0;
        for (let i = 0; i < newStepIndex; i++) {
          finalCumulativeDistanceForActualCurrentStepStart += steps[i].distance;
        }
        const progressInActualCurrentStep =
          progressAlongEntireRouteMeters -
          finalCumulativeDistanceForActualCurrentStepStart;

        if (newStepIndex < steps.length - 1) {
          const nextManeuverLocation = steps[newStepIndex + 1].maneuver
            .location as Coordinate;
          setDistanceToNextManeuver(
            calculateDistanceInMeters(userLoc, nextManeuverLocation)
          );
          checkAndAnnounceVoiceInstructions(
            currentStepObject,
            progressInActualCurrentStep
          );
        } else {
          const destinationCoords = selectedRoute.geometry.coordinates[
            selectedRoute.geometry.coordinates.length - 1
          ] as Coordinate;
          const distToDest = calculateDistanceInMeters(
            userLoc,
            destinationCoords
          );
          setDistanceToNextManeuver(distToDest);

          if (hasArrivedAtDestination(selectedRoute, userLoc)) {
            speakInstruction("Vous êtes arrivé à destination", true);
            setIsNavigating(false);
            if (onArrive) onArrive();
          } else {
            checkAndAnnounceVoiceInstructions(
              currentStepObject,
              progressInActualCurrentStep
            );
          }
        }

        setRemainingDistance(
          Math.max(0, selectedRoute.distance - progressAlongEntireRouteMeters)
        );
        const progressPercentage =
          selectedRoute.distance > 0
            ? progressAlongEntireRouteMeters / selectedRoute.distance
            : 0;
        setRemainingDuration(selectedRoute.duration * (1 - progressPercentage));
        setEstimatedArrival(
          new Date(
            Date.now() +
              selectedRoute.duration * (1 - progressPercentage) * 1000
          )
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
    } else if (!isNavigating) {
      if (traveledCoords.length > 0) {
        setTraveledCoords([]);
      }
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
      await startLocationTracking();
      // Initialize routeRef here before setting isNavigating if selectedRoute might not change
      routeRef.current = selectedRoute;
      setIsNavigating(true);
      // The useEffect watching selectedRoute & isNavigating will handle initial setup,
      // but let's ensure a clean slate here too.
      setCurrentStepIndex(0);
      setAnnouncementsMadeForStep(new Set());
      offRouteCountRef.current = 0;
      setTraveledCoords(
        selectedRoute.geometry.coordinates.length > 0
          ? [selectedRoute.geometry.coordinates[0] as Coordinate]
          : []
      );
      setRemainingDistance(selectedRoute.distance);
      setRemainingDuration(selectedRoute.duration);
      setEstimatedArrival(new Date(Date.now() + selectedRoute.duration * 1000));

      if (selectedRoute.legs[0]?.steps[0]) {
        let instructionToSpeakAndDisplay =
          selectedRoute.legs[0].steps[0].maneuver.instruction;
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
    setIsNavigating(false); // This will trigger the useEffect to clear traveledCoords
    setDisplayedInstruction("");
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
    displayedInstruction,
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
