import * as turf from '@turf/turf';
import { Route, Step, VoiceInstruction } from '@/types/mapbox';
import { UserPreferences } from '@/types/api';

/**
 * Convert user preferences to Mapbox route exclude parameters
 */
export const getExcludesFromPreferences = (preferences?: UserPreferences): string[] => {
  if (!preferences) return [];
  
  const excludes: string[] = [];
  if (preferences.avoid_tolls) excludes.push('toll');
  if (preferences.avoid_highways) excludes.push('motorway');
  if (preferences.avoid_unpaved) excludes.push('unpaved');
  
  return excludes;
};

/**
 * Find the closest point on a route to the user's current location
 */
export const findNearestPointOnRoute = (
  route: Route,
  userLocation: [number, number]
): {
  point: turf.Feature<turf.Point, turf.Properties>;
  distance: number;
  index: number;
  location: number;
} => {
  // Convert route to a LineString
  const routeLine = turf.lineString(route.geometry.coordinates);
  
  // Find nearest point on the route line
  const userPoint = turf.point(userLocation);
  const nearestPoint = turf.nearestPointOnLine(routeLine, userPoint, { units: 'meters' });
  
  return {
    point: nearestPoint,
    distance: nearestPoint.properties.dist || Infinity,
    index: nearestPoint.properties.index || 0,
    location: nearestPoint.properties.location || 0
  };
};

/**
 * Calculate the distance from a point to the next maneuver
 */
export const calculateDistanceToNextManeuver = (
  route: Route,
  currentStepIndex: number,
  userLocation: [number, number]
): number => {
  // Check if we're on the last step
  const steps = route.legs[0]?.steps || [];
  if (currentStepIndex >= steps.length - 1) {
    // Calculate distance to destination
    const destinationCoords = route.geometry.coordinates[route.geometry.coordinates.length - 1];
    return turf.distance(
      turf.point(userLocation),
      turf.point(destinationCoords),
      { units: 'meters' }
    ) * 1000; // Convert km to meters
  }
  
  // Calculate distance to next maneuver
  const nextManeuver = steps[currentStepIndex + 1].maneuver;
  return turf.distance(
    turf.point(userLocation),
    turf.point(nextManeuver.location),
    { units: 'meters' }
  ) * 1000; // Convert km to meters
};

/**
 * Find the current step in the route based on user's location
 */
export const findCurrentStepIndex = (
  route: Route,
  locationOnRoute: number
): number => {
  const steps = route.legs[0]?.steps || [];
  if (steps.length === 0) return 0;
  
  let cumulativeDistance = 0;
  
  for (let i = 0; i < steps.length; i++) {
    const stepDistance = steps[i].distance;
    if (locationOnRoute >= cumulativeDistance && locationOnRoute < cumulativeDistance + stepDistance) {
      return i;
    }
    cumulativeDistance += stepDistance;
  }
  
  // If we couldn't determine the step, return the first one
  return 0;
};

/**
 * Find the appropriate voice instruction for the current distance to next maneuver
 */
export const findVoiceInstructionForDistance = (
  instructions: VoiceInstruction[],
  currentDistance: number
): VoiceInstruction | undefined => {
  // Sort instructions by distance (descending)
  const sortedInstructions = [...instructions].sort(
    (a, b) => b.distanceAlongGeometry - a.distanceAlongGeometry
  );
  
  // Find the first instruction with a distance less than the current distance
  return sortedInstructions.find(
    instruction => instruction.distanceAlongGeometry <= currentDistance + 10
  );
};

/**
 * Format a maneuver instruction to be more user-friendly
 */
export const formatInstruction = (
  instruction: string, 
  distanceToNextManeuver: number | null
): string => {
  // Add distance information
  if (distanceToNextManeuver !== null) {
    const distance = distanceToNextManeuver < 1000 
      ? `${Math.round(distanceToNextManeuver)} mètres` 
      : `${(distanceToNextManeuver / 1000).toFixed(1)} kilomètres`;
    
    // Check if instruction already contains distance information
    if (!instruction.includes('mètres') && !instruction.includes('kilomètre')) {
      return `Dans ${distance}, ${instruction.toLowerCase()}`;
    }
  }
  
  return instruction;
};

/**
 * Determine if route recalculation is needed based on time and distance
 */
export const shouldRecalculateRoute = (
  userLocation: [number, number],
  lastRerouteLocation: [number, number] | null,
  lastRerouteTime: number,
  minTimeThreshold: number,
  minDistanceThreshold: number,
  isRerouting: boolean
): boolean => {
  const now = Date.now();
  
  // If we're already rerouting, wait until it's done
  if (isRerouting) return false;
  
  // Check if enough time has passed since last reroute
  const timeSinceLastReroute = now - lastRerouteTime;
  if (timeSinceLastReroute < minTimeThreshold) return false;
  
  // Check if we've moved enough since last reroute
  if (lastRerouteLocation) {
    const distanceSinceLastReroute = turf.distance(
      turf.point(userLocation),
      turf.point(lastRerouteLocation),
      { units: 'meters' }
    );
    
    if (distanceSinceLastReroute < minDistanceThreshold) return false;
  }
  
  return true;
};

/**
 * Get the appropriate voice instructions from a step based on distance
 */
export const getAnnouncementFromStep = (
  step: Step,
  distanceToManeuver: number
): string | null => {
  if (!step.voiceInstructions || step.voiceInstructions.length === 0) {
    return step.maneuver.instruction;
  }
  
  const instruction = findVoiceInstructionForDistance(
    step.voiceInstructions,
    distanceToManeuver
  );
  
  return instruction ? instruction.announcement : null;
};

/**
 * Check if the user has arrived at the destination
 */
export const hasArrivedAtDestination = (
  route: Route,
  userLocation: [number, number],
  threshold: number = 20
): boolean => {
  const destination = route.geometry.coordinates[route.geometry.coordinates.length - 1];
  const distance = turf.distance(
    turf.point(userLocation),
    turf.point(destination),
    { units: 'meters' }
  ) * 1000; // Convert km to meters
  
  return distance < threshold;
};

/**
 * Generate tracking coordinates from the route line for animation
 */
export const generateTrackingCoordinates = (
  route: Route,
  interval: number = 50 // meters
): [number, number][] => {
  const coordinates: [number, number][] = [];
  const line = turf.lineString(route.geometry.coordinates);
  const length = turf.length(line, { units: 'meters' });
  
  // Calculate the number of points to generate
  const numPoints = Math.ceil(length / interval);
  
  for (let i = 0; i <= numPoints; i++) {
    const distance = (i / numPoints) * length;
    const point = turf.along(line, distance, { units: 'meters' });
    coordinates.push(point.geometry.coordinates as [number, number]);
  }
  
  return coordinates;
};
