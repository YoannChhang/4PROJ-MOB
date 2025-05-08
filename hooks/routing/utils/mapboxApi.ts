// src/hooks/routing/utils/mapboxApi.ts
import mapboxService from '@/services/mapboxService';
import { MapboxDirectionsResponse } from '@/types/mapbox';
import { Coordinate } from './types';

/**
 * Helper function to fetch routes with specific exclusions
 * @param origin Starting point [longitude, latitude]
 * @param destination Ending point [longitude, latitude]
 * @param options Additional routing options
 * @returns Promise with Mapbox Directions API response
 */
export const fetchRoute = async (
  origin: Coordinate,
  destination: Coordinate,
  options: {
    excludes?: string[];
    alternatives?: boolean;
    language?: string;
  } = {}
): Promise<MapboxDirectionsResponse> => {
  // Use the existing mapboxService
  return mapboxService.getDirections(origin, destination, {
    excludes: options.excludes,
    alternatives: options.alternatives,
    language: options.language
  });
};

/**
 * Get a simplified route without detailed steps and voice instructions
 * (useful for displaying routes quickly without navigation details)
 */
export const fetchSimplifiedRoute = async (
  origin: Coordinate,
  destination: Coordinate,
  excludes: string[] = []
): Promise<MapboxDirectionsResponse> => {
  // Use the existing mapboxService
  return mapboxService.getSimpleRoute(origin, destination, {
    excludes
  });
};

/**
 * Recalculate a route when user goes off course
 */
export const recalculateRoute = async (
  currentLocation: Coordinate,
  destination: Coordinate,
  options: {
    excludes?: string[];
    language?: string;
  } = {}
): Promise<MapboxDirectionsResponse> => {
  // Use the existing mapboxService
  return mapboxService.recalculateRoute(currentLocation, destination, {
    excludes: options.excludes,
    language: options.language
  });
};

/**
 * Check if the Mapbox API is accessible
 * @returns Promise resolving to boolean indicating if the API is accessible
 */
export const checkMapboxConnection = async (): Promise<boolean> => {
  return mapboxService.checkConnection();
};