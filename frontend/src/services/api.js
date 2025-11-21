import axios from "axios";

// -------------------------
// 1. AXIOS INSTANCE
// -------------------------
export const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

// -------------------------
// 2. TOKEN INJECTION INTERCEPTOR
// -------------------------
apiClient.interceptors.request.use(
  (config) => {
    // Make sure this matches the key where you store the JWT
    const token = localStorage.getItem("access_token") || localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// -------------------------
// 2. API CATEGORY WRAPPERS
// -------------------------
export const AuthAPI = {
  login(credentials) {
    return apiClient.post("/auth/login-json", {
      email: credentials.email || credentials.username,
      password: credentials.password,
    });
  },
  getCurrentUserInfo() {
    return apiClient.get("/auth/me");
  },
  register(data) {
    return apiClient.post("/auth/register", data);
  },
  // ✅ NEW: Update current user profile
  updateProfile(data) {
    return apiClient.put("/auth/me", data);
  },
  // ✅ NEW: Change password
  changePassword(data) {
    return apiClient.put("/auth/me/password", data);
  },
  // ✅ NEW: Upload avatar
  uploadAvatar(formData) {
    return apiClient.post("/auth/me/avatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

export const TaskAPI = {
  // ✅ FIXED: Now accepts params object for pagination and filtering
  getTasks(params = {}) {
    return apiClient.get("/tasks/", { params });
  },
  createTask(data) {
    return apiClient.post("/tasks/", data);
  },
  getTaskById(id) {
    return apiClient.get(`/tasks/${id}`);
  },
  updateTask(id, data) {
    return apiClient.put(`/tasks/${id}`, data);
  },
  deleteTask(id) {
    return apiClient.delete(`/tasks/${id}`);
  },
};

export const UserAPI = {
  getUsers() {
    return apiClient.get("/users/");
  },
  
  // ✅ NEW: Admin Wipe Endpoints (from users.py)
  wipeAllUsers() {
    return apiClient.delete("/users/admin/wipe-users");
  },
  
  wipeAllTasks() {
    return apiClient.delete("/users/admin/wipe-tasks");
  }
};

export const LocationAPI = {
  getLocations(taskId) {
    return apiClient.get(`/locations/${taskId}`);
  },
  getLatestLocation(taskId) {
    return apiClient.get(`/locations/${taskId}/latest`);
  },
  getNearestEmployee(data) {
    return apiClient.post("/locations/employees/nearest", data);
  },
};

export const ForecastAPI = {
  getTaskForecast(forecastData) {
    return apiClient.post("/analytics/forecast", forecastData);
  },
  predictMultiDestination(forecastData) {
    return apiClient.post(
      "/predictions/predict-multi-destination",
      forecastData
    );
  },
  compareEmployeeForecasts(data) {
    return apiClient.post("/analytics/forecast/compare-employees", data);
  },
  getModelStatus() {
    return apiClient.get("/analytics/forecast/model-status");
  },
  getNearestEmployee: LocationAPI.getNearestEmployee,
};

// -------------------------
// 3. Analytics / Legacy methods
// -------------------------
export const AnalyticsAPI = {
  getAnalyticsOverview() {
    return apiClient.get("/analytics/kpi/overview");
  },
  getTeamOverview() {
    return apiClient.get("/analytics/team/overview");
  },
  getFeatureImportance() {
    return apiClient.get("/analytics/feature-importance");
  },
  getAnalytics() {
    return apiClient.get("/analytics/performance");
  },
  // ✅ NEW: Get comprehensive KPI dashboard for specific employee
  getEmployeeKPIs(employeeId, days = 30) {
    return apiClient.get(`/analytics/employees/${employeeId}/kpis?days=${days}`);
  },
  // ✅ NEW: Check ML Model Health (from predictions.py)
  getModelHealth() {
    return apiClient.get("/predictions/health");
  }
};

// -------------------------
// 4. Admin Operations (✅ NEW ADDITION)
// -------------------------
export const AdminAPI = {
  getAuditLogs(params) {
    return apiClient.get('/admin/audit-logs', { params });
  },
  triggerRetrain() {
    return apiClient.post('/admin/retrain-model');
  }
};

// -------------------------
// 5. DEFAULT EXPORT (BACKWARD-COMPATIBLE)
// -------------------------
const API = {
  apiClient,
  AuthAPI,
  TaskAPI,
  UserAPI,
  LocationAPI,
  ForecastAPI,
  AnalyticsAPI,
  AdminAPI, // ✅ NEW

  // Flatten for backward compatibility
  login: AuthAPI.login,
  getCurrentUserInfo: AuthAPI.getCurrentUserInfo,
  register: AuthAPI.register,
  updateProfile: AuthAPI.updateProfile,
  changePassword: AuthAPI.changePassword,
  uploadAvatar: AuthAPI.uploadAvatar,

  getTasks: TaskAPI.getTasks,
  createTask: TaskAPI.createTask,
  getTaskById: TaskAPI.getTaskById,
  updateTask: TaskAPI.updateTask,
  deleteTask: TaskAPI.deleteTask,

  getUsers: UserAPI.getUsers,

  getLocations: LocationAPI.getLocations,
  getLatestLocation: LocationAPI.getLatestLocation,

  getTaskForecast: ForecastAPI.getTaskForecast,
  predictMultiDestination: ForecastAPI.predictMultiDestination,
  compareEmployeeForecasts: ForecastAPI.compareEmployeeForecasts,
  getModelStatus: ForecastAPI.getModelStatus,

  getAnalyticsOverview: AnalyticsAPI.getAnalyticsOverview,
  getTeamOverview: AnalyticsAPI.getTeamOverview,
  getFeatureImportance: AnalyticsAPI.getFeatureImportance,
  getAnalytics: AnalyticsAPI.getAnalytics,
  // ✅ NEW: Employee KPI endpoint
  getEmployeeKPIs: AnalyticsAPI.getEmployeeKPIs,
  
  // Add the new methods to the default export
  getModelHealth: AnalyticsAPI.getModelHealth,
  wipeAllUsers: UserAPI.wipeAllUsers,
  wipeAllTasks: UserAPI.wipeAllTasks,
  
  // ✅ NEW: Admin Helpers
  getAuditLogs: AdminAPI.getAuditLogs,
  triggerRetrain: AdminAPI.triggerRetrain,
};

export default API;