/**
 * Full response object returned by Mapbox Directions API.
 */
export interface MapboxDirectionsResponse {
  routes: Route[];
  waypoints: Waypoint[];
  code: string;
  uuid: string;
}

/**
 * Represents a complete route from origin to destination,
 * including distance, duration, geometry, and navigation metadata.
 */
export interface Route {
  weight_typical: number;
  duration_typical: number;
  is_prefered: boolean;
  weight_name: string;
  weight: number;
  duration: number;
  distance: number;
  legs: Leg[];
  geometry: GeoJSON.LineString;
  voiceLocale: string;
}

/**
 * Represents a waypoint (origin, destination or intermediate) on a route.
 */
export interface Waypoint {
  time_zone: TimeZone;
  distance: number;
  name: string;
  location: GeoJSON.Position; // [longitude, latitude]
}

/**
 * Time zone data associated with a waypoint.
 */
export interface TimeZone {
  abbreviation: string;
  identifier: string;
  offset: string;
}

/**
 * A leg is a segment of the route between two waypoints.
 */
export interface Leg {
  via_waypoints: any[]; // usually empty or omitted
  admins: Admin[];
  weight_typical: number;
  duration_typical: number;
  weight: number;
  duration: number;
  steps: Step[];
  distance: number;
  summary: string;
}

/**
 * Administrative region crossed by a leg (e.g. country or state codes).
 */
export interface Admin {
  iso_3166_1_alpha2?: string;
  iso_3166_1?: string;
}

/**
 * A step is a navigable segment within a leg (e.g. "turn right onto Main Street").
 */
export interface Step {
  intersections?: Intersection[];
  driving_side?: "left" | "right";
  geometry: GeoJSON.LineString;
  mode: "driving" | "walking" | "cycling";
  maneuver: Maneuver;
  ref?: string;
  weight: number;
  duration: number;
  name: string;
  distance: number;
  voiceInstructions?: VoiceInstruction[];
  bannerInstructions?: BannerInstruction[];
  annotation?: {
    congestion?: string[];
    speed?: number[];
    duration?: number[];
    distance?: number[];
  };
}

/**
 * Represents an intersection encountered in a step.
 */
export interface Intersection {
  out?: number;
  in?: number;
  entry: boolean[];
  bearings: number[];
  location: GeoJSON.Position;
}

/**
 * Describes a navigation maneuver at a given point (e.g. turn, merge, etc.).
 */
export interface Maneuver {
  bearing_after: number;
  bearing_before: number;
  location: GeoJSON.Position;
  modifier?: "left" | "right" | "straight" | "uturn";
  type: string;
  instruction: string;
}

/**
 * Voice instructions to be read during navigation.
 */
export interface VoiceInstruction {
  distanceAlongGeometry: number;
  announcement: string;
  ssmlAnnouncement: string;
}

/**
 * Visual instruction to be shown on screen (e.g. banners).
 */
export interface BannerInstruction {
  distanceAlongGeometry: number;
  primary: BannerText;
  secondary?: BannerText;
  sub?: BannerText;
}

/**
 * Textual representation of a banner instruction (primary, secondary, sub).
 */
export interface BannerText {
  text: string;
  components: { text: string }[];
  type: string;
  modifier?: "left" | "right" | "straight" | "uturn";
}

/**
 * Summarized features about a route used for UI feedback or route comparison.
 */
export interface RouteFeatures {
  hasHighways: boolean;
  hasTolls: boolean;
  hasUnpavedRoads: boolean;
  estimatedTime: string; // formatted time string
  distance: string;      // formatted distance string
  trafficLevel: "low" | "moderate" | "heavy" | "severe" | "unknown";
}

/**
 * Congestion info per segment (e.g. per step or annotation).
 */
export interface CongestionAnnotation {
  congestion: string[]; // e.g. ["moderate", "low", "heavy"]
}
