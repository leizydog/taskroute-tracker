// src/services/api.js
import axios from 'axios';

// Create an Axios instance
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token automatically
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default {
  // --- Authentication ---
  login(credentials) {
    return apiClient.post('/auth/login-json', {
      email: credentials.email || credentials.username,
      password: credentials.password
    });
  },

  getCurrentUserInfo() {
    return apiClient.get('/auth/me');
  },

  register(userData) {
    return apiClient.post('/auth/register', userData);
  },

  // --- Tasks ---
  getTasks() {
    return apiClient.get('/tasks/');
  },

  createTask(taskData) {
    return apiClient.post('/tasks/', taskData);
  },

  getTaskById(taskId) {
    return apiClient.get(`/tasks/${taskId}`);
  },

  updateTask(taskId, taskData) {
    return apiClient.put(`/tasks/${taskId}`, taskData);
  },

  deleteTask(taskId) {
    return apiClient.delete(`/tasks/${taskId}`);
  },

  // --- Users/Employees ---
  getUsers() {
    return apiClient.get('/users/');
  },

  // --- Locations ---
  getLocations(taskId) {
    return apiClient.get(`/locations/${taskId}`);
  },

  // ✅ FIXED: Use the /latest endpoint that exists in your backend
  getLatestLocation(taskId) {
    return apiClient.get(`/locations/${taskId}/latest`);
  },

  // Legacy method for backwards compatibility
  getLocationHistory({ taskId, limit = 100 }) {
    if (taskId) {
      // For single task, get all locations
      return apiClient.get(`/locations/${taskId}`);
    }
    // If no taskId, this won't work with current backend
    console.warn('getLocationHistory without taskId is not supported');
    return Promise.resolve({ data: [] });
  },

  // --- Analytics ---
  getAnalyticsOverview() {
    return apiClient.get('/analytics/kpi/overview');
  },

  getTeamOverview() {
    return apiClient.get('/analytics/team/overview');
  },

  getFeatureImportance() {
    return apiClient.get('/analytics/feature-importance');
  },

  getTaskForecast(forecastData) {
    return apiClient.post('/analytics/forecast', forecastData);
  },

   // ✅ Add this method
   getLatestLocation(taskId) {
    return apiClient.get(`/locations/${taskId}/latest`);
  },

  // Legacy method (keeping for backwards compatibility)
  getAnalytics() {
    return apiClient.get('/analytics/performance');
  },
};