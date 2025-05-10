// hooks/routing/utils/mapboxApi.ts
import axios from "axios";
import { MapboxDirectionsResponse } from "@/types/mapbox";
import { Coordinate } from "./types";
import { MAPBOX_ACCESS_TOKEN } from "./constants"; // Ensure this is correctly imported and valid

/**
 * Get driving directions between two points
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
  let url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    alternatives:
      options?.alternatives !== undefined
        ? String(options.alternatives)
        : "true",
    geometries: "geojson",
    overview: "full",
    steps: "true",
    voice_instructions: "true",
    voice_units: "metric",
    language: options?.language || "fr",
    annotations: "duration,distance,speed,congestion",
  });
  if (options?.excludes && options.excludes.length > 0) {
    params.append("exclude", options.excludes.join(","));
  }
  url += `?${params.toString()}`;

  try {
    console.log(`Fetching route from Mapbox: ${url}`); // Log the request
    const response = await axios.get<MapboxDirectionsResponse>(url);
    console.log("Mapbox response received:", response.status);
    return response.data;
  } catch (error) {
    console.error(
      "Error fetching directions from Mapbox:",
      axios.isAxiosError(error) && error.response ? error.response.data : (error as Error).message
    );
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
  console.log(
    `Recalculating route from ${currentLocation} to ${destination} with excludes: ${options?.excludes}`
  );
  return fetchRoute(currentLocation, destination, {
    alternatives: false, // Typically, for rerouting, you want the single best new route
    excludes: options?.excludes,
    language: options?.language,
  });
};
