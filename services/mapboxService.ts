import axios from 'axios';
import { MapboxDirectionsResponse } from '@/types/mapbox';
import { MAPBOX_ACCESS_TOKEN } from '@/hooks/routing/utils/constants';


/**
 * Service to interact with Mapbox Directions API
 */
class MapboxService {
  /**
   * Get driving directions between two points
   * 
   * @param origin Starting coordinates [longitude, latitude]
   * @param destination Ending coordinates [longitude, latitude]
   * @param options Additional options for the route
   * @returns Promise with the directions response
   */
  public async getDirections(
    origin: [number, number],
    destination: [number, number],
    options?: {
      alternatives?: boolean;
      excludes?: string[];
      language?: string;
    }
  ): Promise<MapboxDirectionsResponse> {
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
  }

  /**
   * Get a simplified route without detailed steps and voice instructions
   * (useful for displaying routes quickly without navigation details)
   */
  public async getSimpleRoute(
    origin: [number, number],
    destination: [number, number],
    options?: {
      excludes?: string[];
    }
  ): Promise<MapboxDirectionsResponse> {
    // Format the request URL
    let url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
    
    // Add query parameters
    const params = new URLSearchParams({
      access_token: MAPBOX_ACCESS_TOKEN,
      alternatives: 'false',
      geometries: 'geojson',
      overview: 'full',
      steps: 'false', // Don't need detailed steps for simple route
      annotations: 'distance,duration'
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
      console.error('Error fetching simple route from Mapbox:', error);
      throw error;
    }
  }

  /**
   * Recalculate a route when the user goes off course
   */
  public async recalculateRoute(
    currentLocation: [number, number],
    destination: [number, number],
    options?: {
      excludes?: string[];
      language?: string;
    }
  ): Promise<MapboxDirectionsResponse> {
    // Simplify options for rerouting - we only need the main route
    return this.getDirections(
      currentLocation,
      destination,
      {
        alternatives: false,
        excludes: options?.excludes,
        language: options?.language
      }
    );
  }

  /**
   * Check if the Mapbox API is accessible
   */
  public async checkConnection(): Promise<boolean> {
    try {
      // Simple request to test connectivity
      const testUrl = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving?access_token=${MAPBOX_ACCESS_TOKEN}`;
      await axios.get(testUrl);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Create a singleton instance
const mapboxService = new MapboxService();
export default mapboxService;