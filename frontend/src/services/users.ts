import api from './api';

export const userService = {
  getAll: async () => {
    const { data } = await api.get('/users');
    return data;
  },

  getOne: async (id: string) => {
    const { data } = await api.get(`/users/${id}`);
    return data;
  },

  create: async (userData: {
    username: string;
    password: string;
    name: string;
    email?: string;
    role?: string;
  }) => {
    const { data } = await api.post('/users', userData);
    return data;
  },

  update: async (id: string, userData: any) => {
    const { data } = await api.put(`/users/${id}`, userData);
    return data;
  },

  remove: async (id: string) => {
    const { data } = await api.delete(`/users/${id}`);
    return data;
  },
};
