import { apiClient } from './api';
import { User, UserRole } from '../types';

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface DemoUsersResponse {
  default_password: string;
  roles: {
    role: UserRole;
    email: string;
    name: string;
    description: string;
  }[];
}

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  const { access_token, user } = response.data;
  localStorage.setItem('chainstate_token', access_token);
  localStorage.setItem('chainstate_user', JSON.stringify(user));
  return response.data;
};

export const fetchCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<User>('/auth/me');
  localStorage.setItem('chainstate_user', JSON.stringify(response.data));
  return response.data;
};

export const fetchDemoUsers = async (): Promise<DemoUsersResponse> => {
  const response = await apiClient.get<DemoUsersResponse>('/auth/demo-users');
  return response.data;
};

export const logoutUser = (): void => {
  localStorage.removeItem('chainstate_token');
  localStorage.removeItem('chainstate_user');
};

export const getStoredUser = (): User | null => {
  const saved = localStorage.getItem('chainstate_user');
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
};
