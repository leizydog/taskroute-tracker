import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import api from "../services/api";
import toast from "react-hot-toast";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) return savedTheme === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // ✅ NEW: Memoized function to fetch the latest user data
  const refreshUser = useCallback(async () => {
    if (token) {
      api.apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        const response = await api.getCurrentUserInfo();
        setUser(response.data);
      } catch (error) {
        console.error("Error loading user:", error);
        // Optionally log user out if token is invalid
      }
    }
    setLoading(false);
  }, [token]);


  useEffect(() => {
    // Use the new memoized function to load user data on app start
    refreshUser();
  }, [refreshUser]); // Depend on refreshUser

  const login = async (email, password) => {
    try {
      const response = await api.login({ email, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem("token", access_token);
      setToken(access_token);

      let finalUser = userData;
      if (!finalUser) {
         const userResponse = await api.getCurrentUserInfo();
         finalUser = userResponse.data;
      }
      
      setUser(finalUser);
      toast.success("Login successful!");
      return { success: true, data: finalUser };
    } catch (error) {
      const message = error.response?.data?.detail || "Login failed";
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.register(userData);
      toast.success("Registration successful! Please login.");
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.detail || "Registration failed";
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const forgotPassword = async (email) => {
    try {
        await api.forgotPassword(email);
        toast.success("If the email exists, a reset link has been sent.");
        return { success: true };
    } catch (error) {
        console.error("Forgot password error:", error);
        toast.success("If the email exists, a reset link has been sent."); 
        return { success: true };
    }
  };

  const resetPassword = async (token, newPassword) => {
    try {
        await api.resetPassword(token, newPassword);
        toast.success("Password updated successfully!");
        return { success: true };
    } catch (error) {
        console.error("Reset password error:", error);
        const message = error.response?.data?.detail || "Failed to reset password";
        return { success: false, message };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    delete api.apiClient.defaults.headers.common['Authorization'];
    toast.success("Logged out successfully");
  };

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  const value = {
    user,
    token,
    loading,
    login,
    register,
    forgotPassword,
    resetPassword,
    logout,
    refreshUser, // ✅ EXPOSED: Allow components to force a user data reload
    isAuthenticated: !!user,
    isDarkMode,
    toggleDarkMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;