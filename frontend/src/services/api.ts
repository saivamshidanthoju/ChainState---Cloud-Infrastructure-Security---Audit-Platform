import axios from 'axios';
import { DashboardSummary } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('chainstate_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getHealth = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};

export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const response = await apiClient.get('/dashboard/summary');
  return response.data;
};
