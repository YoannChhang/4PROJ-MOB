export interface MapboxDirectionsResponse {
  routes: Route[];
  code: string;
  uuid: string;
}

export interface Route {
  geometry: GeoJSON.LineString;
  waypoints: Waypoint[];
  legs: Leg[];
  weight_name: string;
  weight: number;
  duration: number;
  distance: number;
}

export interface Waypoint {
  name: string;
  location: GeoJSON.Position; // [longitude, latitude]
}

export interface Leg {
  summary: string;
  weight: number;
  duration: number;
  distance: number;
  steps: Step[];
}

export interface Step {
  intersections: Intersection[];
  driving_side: "left" | "right";
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
}

export interface Intersection {
  out?: number;
  in?: number;
  entry: boolean[];
  bearings: number[];
  location: GeoJSON.Position;
}

export interface Maneuver {
  bearing_after: number;
  bearing_before: number;
  location: GeoJSON.Position;
  modifier?: "left" | "right" | "straight" | "uturn";
  type: string;
  instruction: string;
}

export interface VoiceInstruction {
  distanceAlongGeometry: number;
  announcement: string;
  ssmlAnnouncement: string;
}

export interface BannerInstruction {
  distanceAlongGeometry: number;
  primary: BannerText;
  secondary?: BannerText;
  sub?: BannerText;
}

export interface BannerText {
  text: string;
  components: { text: string }[];
  type: string;
  modifier?: "left" | "right" | "straight" | "uturn";
}
