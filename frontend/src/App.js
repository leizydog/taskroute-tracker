import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import SupervisorRoute from './components/SupervisorRoute';
import AdminRoute from './components/AdminRoute';

// ✅ AUTH COMPONENTS
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';

// ✅ PAGES
import SupervisorDashboard from './pages/SupervisorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AccountSettings from './pages/AccountSettings';
import LandingPage from './pages/LandingPage';

import './App.css';

// -----------------------
// AppRoutes Component
// -----------------------
const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Route - Landing Page */}
      <Route 
        path="/" 
        element={isAuthenticated ? <Navigate to="/supervisor" /> : <LandingPage />} 
      />

      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Account Settings (Protected) */}
      <Route
        path="/account-settings"
        element={
          <ProtectedRoute>
            <AccountSettings />
          </ProtectedRoute>
        }
      />

      {/* Supervisor Routes (Protected) */}
      <Route 
        path="/supervisor/*" 
        element={
          <ProtectedRoute>
            <SupervisorRoute>
              <SupervisorDashboard />
            </SupervisorRoute>
          </ProtectedRoute>
        }
      />

      {/* Admin Routes (Protected) */}
      <Route 
        path="/admin/*" 
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      {/* Catch-all Route */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

// -----------------------
// Main App Component
// -----------------------
function App() {
  return (
    <Router>
      {/* ✅ SWAPPED: Mas maganda kung nasa labas si ToastProvider */}
      <ToastProvider> 
        <AuthProvider>
          <div className="App">
            <AppRoutes />
          </div>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;