export interface MapboxDirectionsResponse {
  routes: Route[];
  waypoints: Waypoint[];
  code: string;
  uuid: string;
}

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

export interface Waypoint {
  time_zone: TimeZone;
  distance: number;
  name: string;
  location: GeoJSON.Position; // [longitude, latitude]
}

export interface TimeZone {
  abbreviation: string;
  identifier: string;
  offset: string;
}

export interface Leg {
  via_waypoints: any[]; // usually empty
  admins: Admin[];
  weight_typical: number;
  duration_typical: number;
  weight: number;
  duration: number;
  steps: Step[];
  distance: number;
  summary: string;
}

export interface Admin {
  iso_3166_1_alpha2?: string;
  iso_3166_1?: string;
}

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

// New interfaces for route features
export interface RouteFeatures {
  hasHighways: boolean;
  hasTolls: boolean;
  hasUnpavedRoads: boolean;
  estimatedTime: string; // formatted time
  distance: string; // formatted distance
  trafficLevel: "low" | "moderate" | "heavy" | "severe" | "unknown";
}

export interface CongestionAnnotation {
  congestion: string[]; // Values like "low", "moderate", "heavy", "severe"
}
