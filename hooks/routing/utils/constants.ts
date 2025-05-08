// src/hooks/routing/utils/constants.ts
import Config from 'react-native-config';

// Mapbox API access token
export const MAPBOX_ACCESS_TOKEN = Config.MAPBOX_PK as string;

// Distance threshold in meters to consider if user is off-route
export const OFF_ROUTE_THRESHOLD = 50;

// Distance to announce next maneuver (in meters)
export const ANNOUNCEMENT_DISTANCES = [1000, 500, 200, 100, 50];

// Minimum distance (in meters) between route calculation attempts
export const RECALCULATION_DISTANCE_THRESHOLD = 10;

// Minimum time (in ms) between route calculation attempts
export const RECALCULATION_TIME_THRESHOLD = 10000;

// Default language for navigation instructions
export const DEFAULT_NAVIGATION_LANGUAGE = 'fr-FR';

// Default TTS rate
export const DEFAULT_TTS_RATE = 0.5;