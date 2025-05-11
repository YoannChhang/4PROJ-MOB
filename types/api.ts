// API types based on backend schemas

// User roles in the system (used for permission handling)
export enum RoleEnum {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

// Supported UI language options
export enum PreferredLanguageEnum {
  ENGLISH = 'en',
  FRENCH = 'fr',
}

/**
 * Optional user preferences stored in their profile.
 */
export interface UserPreferences {
  preferred_language?: PreferredLanguageEnum;
  avoid_tolls?: boolean;
  avoid_highways?: boolean;
  avoid_unpaved?: boolean;
}

/**
 * Extended user object returned by the backend.
 * Used for profile display, preferences, and ownership of pins.
 */
export interface User {
  id?: string; // Optional for creation flow
  name?: string;
  email: string;
  role?: RoleEnum;
  created_at?: string;
  preferences: UserPreferences;
  photo?: string | null;
}

/**
 * Payload for login request.
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Payload for registration request.
 */
export interface RegisterInput extends LoginInput {
  name: string;
}

/**
 * Token-based login response.
 */
export interface LoginResponse {
  access_token: string;
}

/**
 * Simple flag response for successful registration.
 */
export interface RegisterResponse {
  ok: boolean;
}

/**
 * Generic structure for any API response wrapping a typed `data` field.
 */
export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
  status?: string;
}

// Type of pins users can report on the map
export type PinType = 'obstacle' | 'traffic_jam' | 'cop' | 'accident' | 'roadwork';

/**
 * Read-only pin object as returned by the backend.
 */
export interface PinRead {
  id: string;
  longitude: number;
  latitude: number;
  type: PinType;
  description?: string | null;
  upvote: number;
  created_at: string;
  user: User;
  deleted_at?: string | null;
  deleted_by_id?: string | null;
}

/**
 * Stats shown to end users in their dashboard.
 */
export interface UserStats {
  total_pins_reported: number;
  total_itineraries: number;
  average_distance: number | null;
  average_time: number | null;
  total_distance: number;
}

/**
 * Extended version of UserStats shown in admin dashboard.
 */
export interface AdminStats extends UserStats {
  total_users: number;
  active_users: number;
  total_pins: number;
  pins_today: number;
  total_itineraries: number;
  itineraries_today: number;
  distance_today: number;
  pins_by_category: Record<string, number>;
}
