import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await forgotPassword(email);
    
    if (result && result.success) {
      setSuccess(true);
    }
    setLoading(false);
  };

  // --- SUCCESS STATE (Kung na-send na) ---
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        {/* Ginamit ko ang SAME CARD STYLE ng Login dito */}
        <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md shadow-xl dark:shadow-2xl rounded-2xl p-10 max-w-md w-full transform transition-all dark:border dark:border-white/20 text-center">
          
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 dark:border dark:border-green-400/30 mb-6">
            <CheckCircle size={32} />
          </div>
          
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4">
            Check Your Email
          </h2>
          
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            We've sent password reset instructions to <br/>
            <span className="font-semibold text-black">{email}</span>.
          </p>
          
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-indigo-600 dark:text-blue-400 hover:text-indigo-500 dark:hover:text-blue-300 font-medium transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  // --- FORM STATE (Input ng Email) ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      
      {/* CARD CONTAINER: Ito ang styling galing sa Login.js */}
      <div className="bg-white dark:bg-white/10 dark:backdrop-blur-md shadow-xl dark:shadow-2xl rounded-2xl p-10 max-w-md w-full transform transition-all hover:shadow-2xl dark:border dark:border-white/20">
        
        <div className="text-center mb-8">
          {/* Icon Style matched with Login */}
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-blue-500/20 text-indigo-600 dark:text-blue-400 dark:border dark:border-blue-400/30">
            <Mail size={32} />
          </div>
          
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Forgot Password?
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            No worries! Enter your email and we'll send you reset instructions.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Email address
            </label>
            
            {/* INPUT STYLE: Matched transparency with Login */}
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full px-4 py-2 bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 rounded-lg shadow-sm placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 dark:focus:ring-blue-500 focus:border-indigo-500 dark:focus:ring-2 dark:focus:border-transparent sm:text-sm transition-all"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            {/* BUTTON STYLE: Matched Login blue button */}
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
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
          Remember your password?{' '}
          <Link
            to="/login"
            className="font-medium text-indigo-600 dark:text-blue-400 hover:text-indigo-500 dark:hover:text-blue-300 transition-colors"
          >
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;