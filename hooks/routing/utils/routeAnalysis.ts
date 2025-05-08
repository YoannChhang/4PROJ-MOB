// src/hooks/routing/utils/routeAnalysis.ts
import * as turf from '@turf/turf';
import { Route } from '@/types/mapbox';
import { RouteFeatures, TrafficLevel } from './types';
import { formatDuration, formatDistance } from './formatters';

/**
 * Analyze traffic level from route congestion data
 * @param route The route to analyze
 * @returns Traffic level category
 */
export const analyzeTrafficLevel = (route: Route): TrafficLevel => {
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
 * Initialize basic route features from a list of routes
 * @param routes Array of routes to analyze
 * @returns Record of route features
 */
export const initializeRouteFeatures = (
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
 * Calculate path similarity between two routes
 * Returns a value between 0 (completely different) and 1 (identical)
 * @param routeA First route 
 * @param routeB Second route
 * @returns Similarity score between 0 and 1
 */
export const calculatePathSimilarity = (routeA: Route, routeB: Route): number => {
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
 * @param boundsA First bounding box [minX, minY, maxX, maxY]
 * @param boundsB Second bounding box [minX, minY, maxX, maxY]
 * @returns Area of overlap
 */
export const calculateBoundsOverlap = (
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
 * Find the nearest point on a route to the user's current location
 * @param route Route to check against
 * @param userLocation User's current location
 * @returns Object with distance and position information
 */
export const findNearestPointOnRoute = (
  route: Route,
  userLocation: number[] | [number, number]
): {
  distance: number;
  index: number;
  location: number;
} => {
  try {
    // Convert route to a LineString
    const routeLine = turf.lineString(route.geometry.coordinates);
    
    // Find nearest point on the route line
    const userPoint = turf.point(userLocation);
    const nearestPoint = turf.nearestPointOnLine(routeLine, userPoint, { units: 'meters' });
    
    return {
      distance: nearestPoint.properties.dist || Infinity,
      index: nearestPoint.properties.index || 0,
      location: nearestPoint.properties.location || 0
    };
  } catch (error) {
    console.error("Error finding nearest point on route:", error);
    return {
      distance: Infinity,
      index: 0,
      location: 0
    };
  }
};

/**
 * Calculate distance between two coordinates in meters
 * @param pointA First coordinate [longitude, latitude]
 * @param pointB Second coordinate [longitude, latitude]
 * @returns Distance in meters
 */
export const calculateDistanceInMeters = (
  pointA: number[] | [number, number],
  pointB: number[] | [number, number]
): number => {
  return turf.distance(turf.point(pointA), turf.point(pointB), { units: 'meters' }) * 1000;
};

/**
 * Check if the user has arrived at the destination
 * @param route Current route
 * @param userLocation User's current location
 * @param threshold Distance threshold in meters to consider as "arrived"
 * @returns Boolean indicating if user has arrived
 */
export const hasArrivedAtDestination = (
  route: Route,
  userLocation: number[] | [number, number],
  threshold: number = 20
): boolean => {
  if (!route || !route.geometry.coordinates.length) return false;
  
  const destination = route.geometry.coordinates[route.geometry.coordinates.length - 1];
  const distance = calculateDistanceInMeters(userLocation, destination);
  
  return distance < threshold;
};