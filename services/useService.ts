import axios from "axios";
import { 
  User, 
  ApiResponse, 
  UserPreferences, 
  LoginInput, 
  RegisterInput, 
  RoleEnum,
  PinType,
  PinRead,
} from "@/types/api";

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || "https://4proj-be.azurewebsites.net",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add interceptor for handling errors consistently
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle specific error codes
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error:', error.response.status, error.response.data);
      
      // Handle 401 Unauthorized errors (token expired)
      if (error.response.status === 401) {
        // Could trigger a sign-out or token refresh here
        console.warn('Authentication token may have expired');
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Network Error:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Set authentication token for all future requests
export const setAuthToken = (token: string | undefined) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// AUTHENTICATION ENDPOINTS

// Google authentication (already implemented but updated)
export const googleAndroid = (token: string): Promise<ApiResponse<any>> =>
  api.post(`/auth/google/android?token_id=${token}`);

export const googleIOS = (token: string): Promise<ApiResponse<any>> =>
  api.post(`/auth/google/ios?token_id=${token}`);

export const googleWeb = (token: string): Promise<ApiResponse<any>> =>
  api.post(`/auth/google/web?token_id=${token}`);

// Login with email and password
export const loginWithEmail = (email: string, password: string): Promise<ApiResponse<any>> =>
  api.post('/login', { email, password } as LoginInput);

// Register a new user
export const registerUser = (userData: RegisterInput): Promise<ApiResponse<any>> =>
  api.post('/register', userData);

// USER MANAGEMENT ENDPOINTS

// Get current user data
export const getCurrentUser = (): Promise<ApiResponse<User>> =>
  api.get('/user/me');

// Get user by ID
export const getUserById = (userId: string): Promise<ApiResponse<User>> =>
  api.post('/user/by_id', { user_id: userId });

// Update user data
export const updateUser = (
  userData: Partial<User & { preferences?: UserPreferences }>
): Promise<ApiResponse<User>> =>
  api.post('/user/update', userData);

// Delete user
export const deleteUser = (userId: string): Promise<ApiResponse<any>> =>
  api.post('/user/delete', { user_id: userId });

// Get paginated list of users
export const getUsersList = (page: number = 1, size: number = 10): Promise<ApiResponse<User[]>> =>
  api.get(`/user/page?page=${page}&size=${size}`);

// ROLE MANAGEMENT ENDPOINTS

// Assign role to user
export const assignRole = (userId: string, role: RoleEnum): Promise<ApiResponse<any>> =>
  api.post('/user/assign_role', { user_id: userId, role });

// USER PREFERENCES

// Update user preferences
export const updateUserPreferences = (preferences: UserPreferences): Promise<ApiResponse<User>> => 
  api.post('/user/update', { preferences });

// PIN MANAGEMENT ENDPOINTS
export interface PinCreate {
  longitude: number;
  latitude: number;
  type: PinType;
  description?: string;
}

export interface PinQuery {
  longitude: number;
  latitude: number;
  radius_km: number;
  include_deleted?: boolean;
}

// Fetch pins nearby user location
export const fetchNearbyPins = async (
  longitude: number,
  latitude: number,
  radiusKm: number = 10
): Promise<ApiResponse<PinRead[]>> =>
  api.post('/pins/nearby', {
    longitude,
    latitude,
    radius_km: radiusKm
  } as PinQuery);

// Create a new pin
export const createPin = async (pinData: PinCreate): Promise<ApiResponse<PinRead>> =>
  api.post('/pins/', pinData);

// Delete a pin
export const deletePin = async (pinId: number): Promise<ApiResponse<PinRead>> =>
  api.delete(`/pins/${pinId}`);