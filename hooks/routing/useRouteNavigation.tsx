// hooks/routing/useRouteNavigation.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import ttsManager from "@/utils/ttsManager";
import { Route, Step, VoiceInstruction } from "@/types/mapbox";
import { Coordinate } from "./utils/types";
import {
  findNearestPointOnRoute,
  calculateDistanceInMeters,
  hasArrivedAtDestination,
  getSlicedRouteGeometry,
} from "./utils/routeAnalysis";
import {
  OFF_ROUTE_THRESHOLD,
  OFF_ROUTE_CONFIRMATION_COUNT,
  ARRIVAL_THRESHOLD_METERS,
  // ARRIVAL_THRESHOLD_METERS, // Consider adding this to constants if you want to configure it
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
  const [traveledCoords, setTraveledCoords] = useState<Coordinate[]>([]);
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
    if (isNavigating && selectedRoute) {
      if (selectedRoute !== routeRef.current) {
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
        setEstimatedArrival(
          new Date(Date.now() + selectedRoute.duration * 1000)
        );

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

        const ACTIVATION_BUFFER_METERS = 30;
        const VI_POINT_TOLERANCE_METERS = 10;

        if (
          progressInCurrentStep >=
            vi.distanceAlongGeometry - ACTIVATION_BUFFER_METERS &&
          progressInCurrentStep <
            vi.distanceAlongGeometry + VI_POINT_TOLERANCE_METERS
        ) {
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

        // Update snapped traveled path
        if (progressAlongEntireRouteMeters >= 0) {
          const snappedTraveledPath = getSlicedRouteGeometry(
            selectedRoute,
            progressAlongEntireRouteMeters
          );
          if (snappedTraveledPath && snappedTraveledPath.length > 0) {
            setTraveledCoords(snappedTraveledPath);
          } else if (
            progressAlongEntireRouteMeters <= 0.1 &&
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

        // 1. Check for off-route first
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

        // 2. Check for ARRIVAL directly (high priority)
        if (
          hasArrivedAtDestination(
            selectedRoute,
            userLoc,
            ARRIVAL_THRESHOLD_METERS
          )
        ) {
          console.log(
            `useRouteNavigation: Arrival detected within ${ARRIVAL_THRESHOLD_METERS}m! Stopping navigation.`
          );
          speakInstruction("Vous êtes arrivé à destination", true);
          setIsNavigating(false);
          if (onArrive) onArrive();
          return; // Stop further processing if arrived
        }

        // 3. If not off-route and not arrived, proceed with step progression and TTS
        let newStepIndex = currentStepIndex;
        let cumulativeDistanceAtStartOfTargetStep = 0;
        let foundStep = false;
        for (let i = 0; i < steps.length; i++) {
          const stepDistance = steps[i].distance;
          if (
            progressAlongEntireRouteMeters >=
              cumulativeDistanceAtStartOfTargetStep &&
            progressAlongEntireRouteMeters <
              cumulativeDistanceAtStartOfTargetStep + stepDistance
          ) {
            newStepIndex = i;
            foundStep = true;
            break;
          }
          cumulativeDistanceAtStartOfTargetStep += stepDistance;
        }

        if (!foundStep && steps.length > 0) {
          if (
            progressAlongEntireRouteMeters >=
            cumulativeDistanceAtStartOfTargetStep
          ) {
            newStepIndex = steps.length - 1;
          } else {
            newStepIndex = Math.max(
              0,
              Math.min(currentStepIndex, steps.length - 1)
            );
          }
        }

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

        // Set distance to next maneuver (for display) - This will be distance to actual next turn or to destination
        if (newStepIndex < steps.length - 1) {
          const nextManeuverLocation = steps[newStepIndex + 1].maneuver
            .location as Coordinate;
          setDistanceToNextManeuver(
            calculateDistanceInMeters(userLoc, nextManeuverLocation)
          );
        } else {
          // Last step, distance to maneuver is distance to destination
          const destinationCoords = selectedRoute.geometry.coordinates[
            selectedRoute.geometry.coordinates.length - 1
          ] as Coordinate;
          setDistanceToNextManeuver(
            calculateDistanceInMeters(userLoc, destinationCoords)
          );
        }

        // Announce voice instructions for the current step (leading up to the next maneuver or destination)
        checkAndAnnounceVoiceInstructions(
          currentStepObject,
          progressInActualCurrentStep
        );

        // Update remaining distance and duration (these are overall route metrics)
        setRemainingDistance(
          Math.max(0, selectedRoute.distance - progressAlongEntireRouteMeters)
        );
        const progressPercentage =
          selectedRoute.distance > 0
            ? progressAlongEntireRouteMeters / selectedRoute.distance
            : 0;
        const estimatedDurationRemaining =
          selectedRoute.duration * (1 - progressPercentage);
        setRemainingDuration(estimatedDurationRemaining);
        setEstimatedArrival(
          new Date(Date.now() + estimatedDurationRemaining * 1000)
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
      routeRef.current = selectedRoute;
      setIsNavigating(true);

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
    setIsNavigating(false);
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
