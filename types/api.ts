// API types based on backend schemas

// User roles
export enum RoleEnum {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

// Language preferences
export enum PreferredLanguageEnum {
  ENGLISH = 'en',
  FRENCH = 'fr',
}

// User preferences
export interface UserPreferences {
  preferred_language?: PreferredLanguageEnum;
  avoid_tolls?: boolean;
  avoid_highways?: boolean;
  avoid_unpaved?: boolean;
}

// Enhanced User interface
export interface User {
  id?: string;  // Making id optional for initial user creation
  name?: string;
  email: string;
  role?: RoleEnum;
  created_at?: string;
  preferences: UserPreferences;
  photo?: string | null;
}

// Login data
export interface LoginInput {
  email: string;
  password: string;
}

// Registration data
export interface RegisterInput extends LoginInput {
  name: string;
}

// Login response
export interface LoginResponse {
  access_token: string;
}

// Register response
export interface RegisterResponse {
  ok: boolean;
}

// API response format
export interface ApiResponse<T> {
  data: T;
  error?: string;
  message?: string;
  status?: string;
}

export type PinType = 'obstacle' | 'traffic_jam' | 'cop' | 'accident' | 'roadwork';

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

// Stats types
export interface UserStats {
  total_pins_reported: number;
  total_itineraries: number;
  average_distance: number | null;
  average_time: number | null;
  total_distance: number;
}

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