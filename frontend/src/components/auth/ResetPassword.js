import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Eye, EyeOff, AlertCircle, Key, Smartphone } from 'lucide-react'; // Added Smartphone icon
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const ResetPassword = () => {
  // --- EXISTING STATE ---
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState(null); 
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword } = useAuth(); 

  const token = searchParams.get('token');

  // ---------------------------------------------------------
  // ✅ NEW: MOBILE DEEP LINK LOGIC
  // ---------------------------------------------------------
  useEffect(() => {
    if (token) {
      // 1. Detect if user is on Mobile (Android/iOS)
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // 2. If mobile, try to open the App automatically
      if (isMobile) {
        // Construct the custom scheme link
        const appDeepLink = `taskroute://reset-password?token=${token}`;
        
        // Try to open it. 
        // If the app is installed, the OS will prompt to open it.
        // If not, the user stays here on the web form.
        window.location.href = appDeepLink;
      }
    }
  }, [token]);
  // ---------------------------------------------------------

  // --- EXISTING LOGIC (Unchanged) ---
  useEffect(() => {
    if (!token) {
        setValidToken(false);
    } else {
        setValidToken(true); 
    }
  }, [token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmVisibility = () => setShowConfirm(!showConfirm);

  const validatePassword = () => {
    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setLoading(true);
    try {
        const result = await resetPassword(token, formData.password);
        if (result.success) {
            setSuccess(true);
            toast.success("Password reset successfully!");
            setTimeout(() => navigate('/login'), 3000);
        } else {
            if (result.message && result.message.toLowerCase().includes('token')) {
                setValidToken(false);
            } else {
                toast.error(result.message || "Failed to reset password");
            }
        }
    } catch (error) {
        console.error(error);
        toast.error("An unexpected error occurred.");
    } finally {
        setLoading(false);
    }
  };

  // --- RENDER STATES ---

  if (validToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-300">Verifying secure link...</p>
        </div>
      </div>
    );
  }

  if (validToken === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md shadow-xl dark:shadow-2xl rounded-2xl p-10 max-w-md w-full text-center border dark:border-white/20">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 mb-6 border dark:border-red-500/30">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">
            Link Expired
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            This password reset link is invalid or has expired.
          </p>
          <Link to="/forgot-password" className="inline-block w-full bg-indigo-600 dark:bg-blue-600 hover:bg-indigo-700 dark:hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition shadow-lg">
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md shadow-xl dark:shadow-2xl rounded-2xl p-10 max-w-md w-full transform transition-all dark:border dark:border-white/20 text-center">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 dark:border dark:border-green-400/30 mb-6">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">
            All Set!
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            Your password has been updated.
          </p>
          <Link to="/login" className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 dark:bg-blue-600 hover:bg-indigo-700 dark:hover:bg-blue-700 shadow-md dark:shadow-lg transform transition hover:scale-[1.02]">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // --- MAIN FORM ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md shadow-xl dark:shadow-2xl rounded-2xl p-10 max-w-md w-full transform transition-all hover:shadow-2xl dark:border dark:border-white/20">
        
        {/* ✅ NEW: Open App Button (Visible only if Mobile) */}
        <div className="sm:hidden mb-6 text-center">
           <a 
             href={`taskroute://reset-password?token=${token}`}
             className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-bold hover:bg-blue-200 transition"
           >
             <Smartphone size={16} /> Open in Mobile App
           </a>
           <div className="relative flex py-5 items-center">
                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OR USE WEB FORM</span>
                <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
           </div>
        </div>

        <div className="text-center">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-blue-500/20 text-indigo-600 dark:text-blue-400 dark:border dark:border-blue-400/30">
            <Key size={32} />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            New Password
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Create a strong password to secure your account.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            
            {/* New Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  className="block w-full px-4 py-2 pr-10 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 rounded-lg shadow-sm placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 dark:focus:ring-blue-500 focus:border-indigo-500 dark:focus:border-transparent sm:text-sm transition-all"
                  placeholder="Min. 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Confirm Password
              </label>
              <div className="relative mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  className="block w-full px-4 py-2 pr-10 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 rounded-lg shadow-sm placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 dark:focus:ring-blue-500 focus:border-indigo-500 dark:focus:border-transparent sm:text-sm transition-all"
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={toggleConfirmVisibility}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 dark:bg-blue-600 hover:bg-indigo-700 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md dark:shadow-lg transform transition hover:scale-[1.02]"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default ResetPassword;