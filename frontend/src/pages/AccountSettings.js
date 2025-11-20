import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Lock, Camera, Save, Phone, Briefcase, 
  Shield, Check, X, Eye, EyeOff, ArrowLeft, LogOut
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import API from '../services/api';

const AccountSettings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    username: '',
    phone: '',
    role: ''
  });

  const [originalProfileData, setOriginalProfileData] = useState({});

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  // Fetch current user data on mount
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setInitialLoading(true);
      const response = await API.getCurrentUserInfo();
      const userData = response.data;
      
      const formattedData = {
        full_name: userData.full_name || '',
        email: userData.email || '',
        username: userData.username || '',
        phone: userData.phone || '',
        role: userData.role || ''
      };
      
      setProfileData(formattedData);
      setOriginalProfileData(formattedData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load user data');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleGoBack = () => {
    window.history.back();
  };

  const handleAvatarChange = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Image must be less than 5MB');
          return;
        }

        try {
          const formData = new FormData();
          formData.append('avatar', file);
          
          await API.uploadAvatar(formData);
          toast.success('Avatar updated successfully!');
          await fetchUserData();
        } catch (error) {
          console.error('Error uploading avatar:', error);
          toast.error(error.message || 'Failed to upload avatar');
        }
      }
    };
    input.click();
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      toast.success('Logged out successfully');
      window.location.href = '/login';
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Only send changed fields
      const changedFields = {};
      Object.keys(profileData).forEach(key => {
        if (profileData[key] !== originalProfileData[key] && key !== 'role') {
          changedFields[key] = profileData[key];
        }
      });

      if (Object.keys(changedFields).length === 0) {
        toast.info('No changes to save');
        setLoading(false);
        return;
      }

      await API.updateProfile(changedFields);
      setOriginalProfileData(profileData);
      toast.success('Profile updated successfully!');
      
      // Refresh user data to ensure sync
      await fetchUserData();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (!passwordData.current_password) {
      toast.error('Please enter your current password');
      return;
    }
    
    if (!passwordData.new_password) {
      toast.error('Please enter a new password');
      return;
    }
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      await API.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      
      toast.success('Password updated successfully!');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const calculatePasswordStrength = (password) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 15;
    if (/[^a-zA-Z\d]/.test(password)) strength += 10;
    return Math.min(strength, 100);
  };

  const passwordStrength = calculatePasswordStrength(passwordData.new_password);

  const getPasswordStrengthColor = (strength) => {
    if (strength < 30) return 'bg-red-500';
    if (strength < 60) return 'bg-yellow-500';
    if (strength < 80) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthLabel = (strength) => {
    if (strength === 0) return '';
    if (strength < 30) return 'Weak';
    if (strength < 60) return 'Fair';
    if (strength < 80) return 'Good';
    return 'Strong';
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {initialLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Header */}
          <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleGoBack}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Account Settings
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Manage your profile and preferences</p>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Profile Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Gradient Banner */}
                <div className="relative h-32 bg-gradient-to-r from-indigo-600 to-purple-600"></div>

                {/* Profile Content */}
                <div className="relative px-6 pb-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-16">
                    {/* Avatar */}
                    <div className="relative group">
                      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold ring-4 ring-white dark:ring-slate-900 shadow-xl">
                        {profileData.full_name ? profileData.full_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <button 
                        onClick={handleAvatarChange}
                        type="button"
                        className="absolute bottom-1 right-1 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>

                    {/* User Info */}
                    <div className="flex-1 text-center sm:text-left sm:mb-3">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                        {profileData.full_name || 'User'}
                      </h2>
                      <p className="text-slate-600 dark:text-slate-400 mb-3 flex items-center justify-center sm:justify-start gap-2">
                        <Mail className="w-4 h-4" />
                        {profileData.email || 'user@example.com'}
                      </p>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-full text-sm font-medium">
                          <Briefcase className="w-4 h-4" />
                          {profileData.role === 'user' ? 'Employee' : profileData.role === 'supervisor' ? 'Supervisor' : profileData.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar Navigation */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="lg:col-span-1"
              >
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 p-2 sticky top-24">
                  <nav className="space-y-1">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all ${
                            activeTab === tab.id
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${
                            activeTab === tab.id 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm">{tab.label}</div>
                          </div>
                        </button>
                      );
                    })}

                    {/* Logout Button */}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border-t border-slate-100 dark:border-slate-800 mt-3 pt-3"
                    >
                      <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <LogOut className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">Logout</div>
                      </div>
                    </button>
                  </nav>
                </div>
              </motion.div>

              {/* Main Content */}
              <div className="lg:col-span-3">
                <AnimatePresence mode="wait">
                  {activeTab === 'profile' && (
                    <motion.div
                      key="profile"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                          <div className="w-12 h-12 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <User className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Personal Information</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Update your personal details</p>
                          </div>
                        </div>
                        
                        <form onSubmit={handleProfileSave} className="space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Full Name
                              </label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                  type="text"
                                  value={profileData.full_name}
                                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-all outline-none text-slate-900 dark:text-slate-100"
                                  placeholder="Enter your full name"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Username
                              </label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                  type="text"
                                  value={profileData.username}
                                  onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-all outline-none text-slate-900 dark:text-slate-100"
                                  placeholder="Enter your username"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Email Address
                              </label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                  type="email"
                                  value={profileData.email}
                                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-all outline-none text-slate-900 dark:text-slate-100"
                                  placeholder="Enter your email"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Phone Number
                              </label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                  type="tel"
                                  value={profileData.phone}
                                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-all outline-none text-slate-900 dark:text-slate-100"
                                  placeholder="Enter your phone number"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                              Role
                            </label>
                            <div className="relative">
                              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <input
                                type="text"
                                value={profileData.role === 'user' ? 'Employee' : profileData.role === 'supervisor' ? 'Supervisor' : profileData.role === 'admin' ? 'Admin' : 'User'}
                                disabled
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 cursor-not-allowed"
                              />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                              Contact your administrator to change your role
                            </p>
                          </div>

                          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => setProfileData(originalProfileData)}
                              className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              Reset
                            </button>
                            <button
                              type="submit"
                              disabled={loading}
                              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loading ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Save Changes
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'security' && (
                    <motion.div
                      key="security"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-5"
                    >
                      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                          <div className="w-12 h-12 rounded-lg bg-red-600 flex items-center justify-center">
                            <Lock className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Change Password</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Keep your account secure</p>
                          </div>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-5">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                              Current Password
                            </label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <input
                                type={showPassword.current ? "text" : "password"}
                                value={passwordData.current_password}
                                onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                                className="w-full pl-10 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-all outline-none text-slate-900 dark:text-slate-100"
                                placeholder="Enter current password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword({...showPassword, current: !showPassword.current})}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                              >
                                {showPassword.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                              New Password
                            </label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <input
                                type={showPassword.new ? "text" : "password"}
                                value={passwordData.new_password}
                                onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                                className="w-full pl-10 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-all outline-none text-slate-900 dark:text-slate-100"
                                placeholder="Enter new password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword({...showPassword, new: !showPassword.new})}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                              >
                                {showPassword.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                            </div>
                            
                            {passwordData.new_password && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="mt-3 space-y-2"
                              >
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-slate-600 dark:text-slate-400 font-medium">Password strength</span>
                                  <span className={`font-bold ${
                                    passwordStrength < 30 ? 'text-red-600' :
                                    passwordStrength < 60 ? 'text-yellow-600' :
                                    passwordStrength < 80 ? 'text-blue-600' :
                                    'text-green-600'
                                  }`}>
                                    {getPasswordStrengthLabel(passwordStrength)}
                                  </span>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${passwordStrength}%` }}
                                    transition={{ duration: 0.3 }}
                                    className={`h-full ${getPasswordStrengthColor(passwordStrength)} rounded-full`}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-3">
                                  <PasswordRequirement 
                                    met={passwordData.new_password.length >= 8}
                                    text="8+ characters"
                                  />
                                  <PasswordRequirement 
                                    met={/[a-z]/.test(passwordData.new_password) && /[A-Z]/.test(passwordData.new_password)}
                                    text="Upper & lowercase"
                                  />
                                  <PasswordRequirement 
                                    met={/\d/.test(passwordData.new_password)}
                                    text="Contains number"
                                  />
                                  <PasswordRequirement 
                                    met={/[^a-zA-Z\d]/.test(passwordData.new_password)}
                                    text="Special character"
                                  />
                                </div>
                              </motion.div>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                              Confirm New Password
                            </label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <input
                                type={showPassword.confirm ? "text" : "password"}
                                value={passwordData.confirm_password}
                                onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                                className="w-full pl-10 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-all outline-none text-slate-900 dark:text-slate-100"
                                placeholder="Confirm new password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword({...showPassword, confirm: !showPassword.confirm})}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                              >
                                {showPassword.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                            </div>
                            <AnimatePresence>
                              {passwordData.confirm_password && (
                                <motion.p
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -5 }}
                                  className={`text-sm mt-2 flex items-center gap-2 ${
                                    passwordData.new_password === passwordData.confirm_password
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }`}
                                >
                                  {passwordData.new_password === passwordData.confirm_password ? (
                                    <><Check className="w-4 h-4" /> Passwords match</>
                                  ) : (
                                    <><X className="w-4 h-4" /> Passwords do not match</>
                                  )}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => setPasswordData({
                                current_password: '',
                                new_password: '',
                                confirm_password: '',
                              })}
                              className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              Clear
                            </button>
                            <button
                              type="submit"
                              disabled={loading}
                              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loading ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <Shield className="w-4 h-4" />
                                  Update Password
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Security Tips */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-3 text-base">Security Best Practices</h3>
                            <ul className="space-y-2">
                              <SecurityTip text="Use a strong, unique password for your account" />
                              <SecurityTip text="Enable two-factor authentication when available" />
                              <SecurityTip text="Never share your password with anyone" />
                              <SecurityTip text="Change your password regularly (every 3-6 months)" />
                              <SecurityTip text="Use a password manager to store credentials safely" />
                            </ul>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Helper Components
const PasswordRequirement = ({ met, text }) => (
  <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
      met ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-slate-800'
    }`}>
      {met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
    </div>
    <span className="font-medium">{text}</span>
  </div>
);

const SecurityTip = ({ text }) => (
  <li className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-200">
    <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
    <span>{text}</span>
  </li>
);

export default AccountSettings;