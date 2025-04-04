import axios from "axios";
import { User, ApiResponse } from "@/types/api";

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getUser = (userId: string): Promise<ApiResponse<User>> =>
  api.get(`/users/${userId}`).then((res) => res.data);

export const updateUser = (
  userId: string,
  data: Partial<User>
): Promise<ApiResponse<User>> =>
  api.put(`/users/${userId}`, data).then((res) => res.data);

export const googleAndroid = (token: string): Promise<ApiResponse<any>> =>
  api.post(`/auth/google/android?token_id=${token}`);

export const googleIOS = (token: string): Promise<ApiResponse<any>> =>
  api.post(`/auth/google/ios?token_id=${token}`);
