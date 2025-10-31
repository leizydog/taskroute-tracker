// src/components/atoms/DarkModeToggle.js
import React from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';

const DarkModeToggle = () => {
  const { isDarkMode, toggleDarkMode } = useAuth();

  return (
    <button
      onClick={toggleDarkMode}
      className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors duration-200"
      aria-label="Toggle dark mode"
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDarkMode ? (
        <FiSun className="w-5 h-5 text-yellow-500" />
      ) : (
        <FiMoon className="w-5 h-5 text-slate-600" />
      )}
    </button>
  );
};

export default DarkModeToggle;