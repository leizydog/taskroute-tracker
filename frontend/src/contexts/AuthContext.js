import React, { createContext, useState, useContext, useEffect } from "react";
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
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) return savedTheme === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

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

  useEffect(() => {
    const loadUser = async () => {
      if (token) {
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
      setToken(access_token);
      if (userData) setUser(userData);
      else {
        const userResponse = await api.getCurrentUserInfo();
        setUser(userResponse.data);
      }
      toast.success("Login successful!");
      return { success: true };
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
    return new Promise((resolve) => {
        setTimeout(() => {
            toast.success("Password reset link sent to your email.");
            resolve({ success: true });
        }, 1500);
    });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
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
    logout,
    isAuthenticated: !!user,
    isDarkMode,
    toggleDarkMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;