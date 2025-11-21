import React, { createContext, useState, useContext, useEffect } from "react";
import api from "../services/api";
import toast from "react-hot-toast";

// Create the context
const AuthContext = createContext();

// Export the useAuth hook for easy consumption
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Export the provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Initialize state directly from localStorage to avoid sync issues
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) return savedTheme === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Apply dark mode to document
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

  // Load user data on app start
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        // Ensure header is set before request
        api.apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const response = await api.getCurrentUserInfo();
          setUser(response.data);
        } catch (error) {
          console.error("Error loading user:", error);
          logout();
        }
      }
      setLoading(false);
    };
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await api.login({ email, password });
      const { access_token, user: userData } = response.data;
      
      // ✅ FIX: Save to LocalStorage IMMEDIATELY
      localStorage.setItem("token", access_token);
      
      // Update state
      setToken(access_token);

      let finalUser = userData;

      // If backend didn't return the user object, fetch it now
      // Since we set localStorage above, this call will succeed
      if (!finalUser) {
         const userResponse = await api.getCurrentUserInfo();
         finalUser = userResponse.data;
      }
      
      setUser(finalUser);
      
      toast.success("Login successful!");
      // ✅ FIX: Return the user data so Login.js doesn't need to fetch it again
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

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token"); // Remove immediately
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
    logout,
    isAuthenticated: !!user,
    isDarkMode,
    toggleDarkMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;