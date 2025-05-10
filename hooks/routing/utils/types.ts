// src/hooks/routing/utils/types.ts
import { Route } from "@/types/mapbox";

/**
 * Enhanced route features interface to track special route characteristics
 */
export interface RouteFeatures {
  hasHighways: boolean;
  hasTolls: boolean;
  hasUnpavedRoads: boolean;
  estimatedTime: string; // formatted time
  distance: string; // formatted distance
  trafficLevel: TrafficLevel;
}

/**
 * Traffic levels on a route
 */
export type TrafficLevel = "low" | "moderate" | "heavy" | "severe" | "unknown";

/**
 * Parameters for calculating a route
 */
export interface RouteCalculationParams {
  origin: [number, number];
  destination: [number, number];
  excludes?: string[];
  language?: string;
  alternatives?: boolean;
}

/**
 * State object for route calculation
 */
export interface RouteCalculationState {
  selectedRoute: Route | null;
  alternateRoutes: Route[];
  loading: boolean;
  error: string | null;
  routeFeatures: Record<string, RouteFeatures>;
}

/**
 * Navigation state
 */
export interface NavigationState {
  isNavigating: boolean;
  liveUserLocation: Coordinate | null;
  traveledCoords: Coordinate[];
  currentStepIndex: number;
  currentInstruction: string;
  distanceToNextManeuver: number | null;
  remainingDistance: number;
  remainingDuration: number;
  estimatedArrival: Date | null;
}

/**
 * Rerouting state
 */
export interface ReroutingState {
  isRerouting: boolean;
  lastRerouteLocation: [number, number] | null;
  lastRerouteTime: number;
}

/**
 * Feature detection state
 */
export interface FeatureDetectionState {
  featureDetectionComplete: boolean;
}

/**
 * A location coordinate
 */
export type Coordinate = [number, number]; // [longitude, latitude]
