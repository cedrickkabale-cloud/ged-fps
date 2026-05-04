import axios from 'axios';

const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Intercepteur : ajouter le token JWT automatiquement
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ged_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur : gérer les erreurs 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('ged_token');
      localStorage.removeItem('ged_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
