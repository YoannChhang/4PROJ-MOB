// hooks/routing/utils/routeAnalysis.ts
import * as turf from "@turf/turf";
import { Route } from "@/types/mapbox";
import { RouteFeatures, TrafficLevel, Coordinate } from "./types";
import { formatDuration, formatDistance } from "./formatters";

/**
 * Analyze traffic level from route congestion data
 * @param route The route to analyze
 * @returns Traffic level category
 */
export const analyzeTrafficLevel = (route: Route): TrafficLevel => {
  let congestionLevels: Record<string, number> = {
    low: 0,
    moderate: 0,
    heavy: 0,
    severe: 0,
    unknown: 0,
  };
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

  const heavyPercent =
    ((congestionLevels["heavy"] + congestionLevels["severe"]) / totalSegments) *
    100;
  const moderatePercent = (congestionLevels["moderate"] / totalSegments) * 100;

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
 * @param routeA First route
 * @param routeB Second route
 * @returns Similarity score between 0 and 1
 */
export const calculatePathSimilarity = (
  routeA: Route,
  routeB: Route
): number => {
  try {
    const lineA = turf.lineString(routeA.geometry.coordinates);
    const lineB = turf.lineString(routeB.geometry.coordinates);
    const boundsA = turf.bbox(lineA);
    const boundsB = turf.bbox(lineB);
    const overlapArea = calculateBoundsOverlap(boundsA, boundsB);
    const areaA = (boundsA[2] - boundsA[0]) * (boundsA[3] - boundsA[1]);
    const areaB = (boundsB[2] - boundsB[0]) * (boundsB[3] - boundsB[1]);
    const maxArea = Math.max(areaA, areaB);
    const overlapRatio = maxArea > 0 ? overlapArea / maxArea : 0;
    const lengthA = turf.length(lineA);
    const lengthB = turf.length(lineB);
    const maxLength = Math.max(lengthA, lengthB);
    const lengthRatio =
      maxLength > 0 ? Math.min(lengthA, lengthB) / maxLength : 0;
    return overlapRatio * 0.7 + lengthRatio * 0.3;
  } catch (error) {
    console.error("Error calculating path similarity:", error);
    return 0.5;
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
  const xOverlap = Math.max(
    0,
    Math.min(boundsA[2], boundsB[2]) - Math.max(boundsA[0], boundsB[0])
  );
  const yOverlap = Math.max(
    0,
    Math.min(boundsA[3], boundsB[3]) - Math.max(boundsA[1], boundsB[1])
  );
  return xOverlap * yOverlap;
};

/**
 * Find the nearest point on a route to the user's current location
 * @param route Route to check against
 * @param userLocation User's current location
 * @returns Object with distance (from route), index (of segment), and location (distance along route in meters)
 */
export const findNearestPointOnRoute = (
  route: Route,
  userLocation: Coordinate
): {
  distance: number;
  index: number;
  location: number; // Distance along the route in meters
} => {
  try {
    const routeLine = turf.lineString(route.geometry.coordinates);
    const userPoint = turf.point(userLocation);
    const nearestPoint = turf.nearestPointOnLine(routeLine, userPoint, {
      units: "meters", // Ensure this is meters
    });
    // .location property from nearestPointOnLine with units: 'meters' IS the distance along the line in meters.
    return {
      distance: nearestPoint.properties.dist || Infinity,
      index: nearestPoint.properties.index || 0,
      location: nearestPoint.properties.location || 0,
    };
  } catch (error) {
    console.error("Error finding nearest point on route:", error);
    return { distance: Infinity, index: 0, location: 0 };
  }
};

/**
 * Calculate distance between two coordinates in meters
 * @param pointA First coordinate [longitude, latitude]
 * @param pointB Second coordinate [longitude, latitude]
 * @returns Distance in meters
 */
export const calculateDistanceInMeters = (
  pointA: Coordinate,
  pointB: Coordinate
): number => {
  return turf.distance(turf.point(pointA), turf.point(pointB), {
    units: "meters",
  });
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
  userLocation: Coordinate,
  threshold: number = 20
): boolean => {
  if (!route || !route.geometry.coordinates.length) return false;
  const destination = route.geometry.coordinates[
    route.geometry.coordinates.length - 1
  ] as Coordinate;
  const distanceToDest = calculateDistanceInMeters(userLocation, destination);
  return distanceToDest < threshold;
};

/**
 * Slices a route's geometry from its start up to a given distance along the route.
 * @param route The Mapbox route object.
 * @param distanceAlongRouteMeters The distance (in meters) to slice up to.
 * @returns An array of Coordinates representing the sliced path, or an empty array if an error occurs or slice is invalid.
 */
export const getSlicedRouteGeometry = (
  route: Route,
  distanceAlongRouteMeters: number
): Coordinate[] => {
  if (
    !route.geometry ||
    !route.geometry.coordinates ||
    route.geometry.coordinates.length < 2
  ) {
    console.warn("getSlicedRouteGeometry: Invalid route geometry provided.");
    return [];
  }
  try {
    const routeLineString = turf.lineString(route.geometry.coordinates);
    const totalRouteLengthMeters = turf.length(routeLineString, {
      units: "meters",
    });

    // Ensure distance is within bounds [0, totalRouteLengthMeters]
    const validDistanceMeters = Math.max(
      0,
      Math.min(distanceAlongRouteMeters, totalRouteLengthMeters)
    );

    if (validDistanceMeters <= 0.1) {
      // Use a small epsilon for floating point comparisons near zero
      // If distance is effectively 0, return just the starting coordinate
      return [route.geometry.coordinates[0] as Coordinate];
    }
    // No need to check for validDistanceMeters >= totalRouteLengthMeters separately,
    // lineSliceAlong handles being at the end of the line correctly.

    const slicedLine = turf.lineSliceAlong(
      routeLineString,
      0,
      validDistanceMeters,
      { units: "meters" }
    );

    // lineSliceAlong might return a feature with null geometry if parameters are invalid
    // or if the slice results in a degenerate geometry (e.g. start and end are the same point after slicing)
    if (
      !slicedLine.geometry ||
      !slicedLine.geometry.coordinates ||
      slicedLine.geometry.coordinates.length === 0
    ) {
      console.warn(
        "getSlicedRouteGeometry: lineSliceAlong resulted in invalid or empty geometry. Distance:",
        validDistanceMeters
      );
      // Fallback to returning just the start point if slice is problematic
      return [route.geometry.coordinates[0] as Coordinate];
    }

    return slicedLine.geometry.coordinates as Coordinate[];
  } catch (error) {
    console.error(
      "Error slicing route geometry:",
      error,
      "Distance:",
      distanceAlongRouteMeters
    );
    // Fallback in case of turf error
    const firstCoord = route.geometry.coordinates[0] as Coordinate;
    return firstCoord ? [firstCoord] : [];
  }
};
