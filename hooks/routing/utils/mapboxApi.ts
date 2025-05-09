import axios from 'axios';
import { MapboxDirectionsResponse } from '@/types/mapbox';
import { Coordinate } from './types';
import { MAPBOX_ACCESS_TOKEN } from './constants';

/**
 * Get driving directions between two points
 * 
 * @param origin Starting coordinates [longitude, latitude]
 * @param destination Ending coordinates [longitude, latitude]
 * @param options Additional options for the route
 * @returns Promise with the directions response
 */
export const fetchRoute = async (
  origin: Coordinate,
  destination: Coordinate,
  options?: {
    alternatives?: boolean;
    excludes?: string[];
    language?: string;
  }
): Promise<MapboxDirectionsResponse> => {
  // Format the request URL
  let url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
  
  // Add query parameters
  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    alternatives: options?.alternatives !== undefined ? String(options.alternatives) : 'true',
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    voice_instructions: 'true',
    voice_units: 'metric',
    language: options?.language || 'fr',
    annotations: 'duration,distance,speed,congestion'
  });

  // Add exclude parameters if needed
  if (options?.excludes && options.excludes.length > 0) {
    params.append('exclude', options.excludes.join(','));
  }

  url += `?${params.toString()}`;

  try {
    const response = await axios.get<MapboxDirectionsResponse>(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching directions from Mapbox:', error);
    throw error;
  }
};

/**
 * Recalculate a route when the user goes off course
 */
export const recalculateRoute = async (
  currentLocation: Coordinate,
  destination: Coordinate,
  options?: {
    excludes?: string[];
    language?: string;
  }
): Promise<MapboxDirectionsResponse> => {
  // Simplify options for rerouting - we only need the main route
  return fetchRoute(
    currentLocation,
    destination,
    {
      alternatives: false,
      excludes: options?.excludes,
      language: options?.language
    }
  );
};