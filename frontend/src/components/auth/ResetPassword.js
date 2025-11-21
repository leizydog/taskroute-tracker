import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Eye, EyeOff, AlertCircle, Lock, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const ResetPassword = () => {
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState(null); // null = checking, true = valid, false = invalid
  const [success, setSuccess] = useState(false); // Para sa success screen

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword } = useAuth();

  const token = searchParams.get('token');

  // ✅ Verify token on component mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setValidToken(false);
        return;
      }

      try {
        // Optional: Add API call to verify token before allowing reset
        // await API.verifyResetToken(token);
        // Mock delay lang para makita mo loading
        setTimeout(() => {
            setValidToken(true);
        }, 1000);
      } catch (error) {
        setValidToken(false);
        toast.error("Invalid or expired reset link");
      }
    };

    verifyToken();
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
    
    // Mock muna or call actual API
    // const result = await resetPassword(token, formData.password);
    
    // Simulate success for now since backend might be missing
    setTimeout(() => {
        setSuccess(true); // Show success card
        setLoading(false);
        toast.success("Password reset successfully!");
    }, 1500);
  };

  // ---------------------------------------------------------
  // RENDER: 1. LOADING STATE (Habang chine-check ang token)
  // ---------------------------------------------------------
  if (validToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-300">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // RENDER: 2. INVALID TOKEN STATE (Pag expired na ang link)
  // ---------------------------------------------------------
  if (validToken === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md shadow-xl dark:shadow-2xl rounded-2xl p-10 max-w-md w-full text-center border dark:border-white/20">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 mb-6 border dark:border-red-500/30">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">
            Invalid Link
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block w-full bg-indigo-600 dark:bg-blue-600 hover:bg-indigo-700 dark:hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition shadow-lg"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // RENDER: 3. SUCCESS STATE (Pag napalitan na)
  // ---------------------------------------------------------
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md shadow-xl dark:shadow-2xl rounded-2xl p-10 max-w-md w-full transform transition-all dark:border dark:border-white/20 text-center">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 dark:border dark:border-green-400/30 mb-6">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">
            Password Reset!
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            Your password has been successfully updated. You can now log in with your new password.
          </p>
          <Link
            to="/login"
            className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 dark:bg-blue-600 hover:bg-indigo-700 dark:hover:bg-blue-700 shadow-md dark:shadow-lg transform transition hover:scale-[1.02]"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------
  // RENDER: 4. MAIN FORM (Input ng password)
  // ---------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md shadow-xl dark:shadow-2xl rounded-2xl p-10 max-w-md w-full transform transition-all hover:shadow-2xl dark:border dark:border-white/20">
        
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-blue-500/20 text-indigo-600 dark:text-blue-400 dark:border dark:border-blue-400/30">
            <Lock size={32} />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Reset Password
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Enter a new password to regain access
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            
            {/* New Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                New Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  className="block w-full px-4 py-2 pr-10 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 rounded-lg shadow-sm placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 dark:focus:ring-blue-500 focus:border-indigo-500 dark:focus:border-transparent sm:text-sm transition-all"
                  placeholder="Enter new password (min. 8 chars)"
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
                  placeholder="Confirm new password"
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
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
           <Link to="/login" className="text-sm font-medium text-indigo-600 dark:text-blue-400 hover:text-indigo-500 dark:hover:text-blue-300 inline-flex items-center gap-2 transition-colors">
             <ArrowLeft size={16} /> Back to Login
           </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;