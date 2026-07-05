import api from './api';
import { AuthResponse, User } from '../types';

export const authService = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login', { username, password });
    return data;
  },

  getProfile: async (): Promise<User> => {
    const { data } = await api.get('/auth/profile');
    return data;
  },

  register: async (userData: {
    username: string;
    password: string;
    name: string;
    email?: string;
    role?: string;
  }): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/register', userData);
    return data;
  },
};
