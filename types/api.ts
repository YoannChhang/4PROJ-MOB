// API types based on backend schemas

// User roles
export enum RoleEnum {
  ADMIN = 'admin',
  USER = 'user',
}

// Travel method preferences
// export enum PreferredTravelMethodEnum {
//   DRIVING = 'driving',
//   WALKING = 'walking',
//   CYCLING = 'cycling',
//   PUBLIC_TRANSPORT = 'public_transport',
// }

// Language preferences
export enum PreferredLanguageEnum {
  ENGLISH = 'en',
  FRENCH = 'fr',
}

// User preferences
export interface UserPreferences {
  preferred_language?: PreferredLanguageEnum;
  // preferred_travel_method?: PreferredTravelMethodEnum;
  avoid_tolls?: boolean;
  avoid_highways?: boolean;
  // avoid_ferries?: boolean;
  avoid_unpaved?: boolean;
}

// Enhanced User interface
export interface User {
  id?: string;  // Making id optional for initial user creation
  name?: string;
  email: string;
  role?: RoleEnum;
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

// API response format
export interface ApiResponse<T> {
  data: T;
  error?: string;
  message: string;
  status: string;
}
