import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Lock, Camera, Save, 
  Shield, Eye, EyeOff, ArrowLeft, LogOut,
  AlertTriangle, Info, CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import API from '../services/api';

// --- Updated Confirmation Modal with Feedback States ---
const ConfirmationModal = ({ isOpen, title, message, type = 'info', status = 'idle', onConfirm, onClose }) => {
  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      icon: AlertTriangle,
      color: 'red',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      iconColor: 'text-red-600 dark:text-red-400',
      btnClass: 'bg-red-600 hover:bg-red-700 text-white'
    },
    info: {
      icon: Info,
      color: 'blue',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
      btnClass: 'bg-blue-600 hover:bg-blue-700 text-white'
    },
    success: {
      icon: CheckCircle,
      color: 'green',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      iconColor: 'text-green-600 dark:text-green-400',
      btnClass: 'bg-green-600 hover:bg-green-700 text-white'
    }
  };

  const config = typeConfig[type] || typeConfig.info;
  
  // Determine Icon and Content based on Status
  let Icon = config.icon;
  let contentTitle = title;
  let contentMessage = message;
  let showButtons = true;

  if (status === 'loading') {
    Icon = Loader2;
    contentTitle = "Processing...";
    contentMessage = "Please wait while we save your changes.";
    showButtons = false;
  } else if (status === 'success') {
    Icon = CheckCircle;
    config.bgColor = 'bg-green-50 dark:bg-green-900/20';
    config.iconColor = 'text-green-600 dark:text-green-400';
    contentTitle = "Success!";
    contentMessage = "Your changes have been saved successfully.";
    showButtons = false;
  } else if (status === 'error') {
    Icon = XCircle;
    config.bgColor = 'bg-red-50 dark:bg-red-900/20';
    config.iconColor = 'text-red-600 dark:text-red-400';
    contentTitle = "Error Occurred";
    // contentMessage keeps the original error details passed in
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-700"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${config.bgColor} flex-shrink-0`}>
              <Icon className={`w-6 h-6 ${config.iconColor} ${status === 'loading' ? 'animate-spin' : ''}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                {contentTitle}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {contentMessage}
              </p>
            </div>
          </div>
        </div>
        
        {showButtons && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg transition-all hover:shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-bold rounded-lg shadow-md transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${config.btnClass}`}
            >
               Confirm
            </button>
          </div>
        )}
        
        {/* Error state close button */}
        {status === 'error' && (
           <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
             <button 
               onClick={onClose}
               className="px-4 py-2 text-sm font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
             >
               Close
             </button>
           </div>
        )}
      </motion.div>
    </div>
  );
};

const AccountSettings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [previewImage, setPreviewImage] = useState(null);
  const [imgVersion, setImgVersion] = useState(Date.now());

  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    status: 'idle', // idle, loading, success, error
    onConfirm: null
  });

  const fileInputRef = useRef(null);

  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    username: '',
    phone: '',
    role: '',
    avatar_url: '' 
  });

  const [originalProfileData, setOriginalProfileData] = useState({});

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const API_URL = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace('/api/v1', '') : 'http://localhost:8000';

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setInitialLoading(true);
      const response = await API.getCurrentUserInfo();
      const userData = response.data;
      
      const safeData = {
        full_name: userData.full_name || '',
        email: userData.email || '',
        username: userData.username || '',
        phone: userData.phone || '', 
        role: userData.role || '',
        avatar_url: userData.avatar_url || '' 
      };
      
      setProfileData(safeData);
      setOriginalProfileData(safeData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load user data');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setPreviewImage(reader.result);
    reader.readAsDataURL(file);

    try {
      const toastId = toast.loading('Uploading avatar...');
      const formData = new FormData();
      formData.append('avatar', file); 
      
      const res = await API.AuthAPI.uploadAvatar(formData);
      
      toast.dismiss(toastId);
      toast.success('Avatar updated successfully!');
      
      setProfileData(prev => ({ ...prev, avatar_url: res.data.avatar_url }));
      setImgVersion(Date.now());
      
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.dismiss();
      toast.error('Failed to upload. Please try again.');
      setPreviewImage(null);
    } finally {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  // --- 1. Profile Save Logic ---
  const handleProfileSave = (e) => {
    e.preventDefault();
    
    const changedFields = {};
    const editableFields = ['full_name', 'email', 'username', 'phone'];
    
    editableFields.forEach(key => {
      if (profileData[key] !== originalProfileData[key]) {
        changedFields[key] = profileData[key];
      }
    });

    if (Object.keys(changedFields).length === 0) {
      toast('No changes detected.', { icon: 'ℹ️' });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Save Profile Changes?',
      message: 'Are you sure you want to update your profile information?',
      type: 'info',
      status: 'idle',
      onConfirm: () => executeProfileSave(changedFields)
    });
  };

  const executeProfileSave = async (changedFields) => {
    setConfirmModal(prev => ({ ...prev, status: 'loading' }));
    
    try {
      await API.updateProfile(changedFields);
      setOriginalProfileData({ ...originalProfileData, ...changedFields });
      
      // ✅ Success Feedback inside Modal
      setConfirmModal(prev => ({ ...prev, status: 'success' }));
      
      // Auto close after 1.5 seconds
      setTimeout(() => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        toast.success('Profile updated successfully!');
      }, 1500);
      
    } catch (error) {
      console.error('Update error:', error);
      // ❌ Error Feedback inside Modal
      setConfirmModal(prev => ({ 
        ...prev, 
        status: 'error', 
        message: error.response?.data?.detail || 'Failed to save profile. Please try again.'
      }));
    }
  };

  // --- 2. Password Change Logic ---
  const handlePasswordChange = (e) => {
    e.preventDefault();
    
    if (!passwordData.current_password) return toast.error('Please enter your current password');
    if (!passwordData.new_password) return toast.error('Please enter a new password');
    if (passwordData.new_password !== passwordData.confirm_password) return toast.error('New passwords do not match');
    if (passwordData.new_password.length < 8) return toast.error('Password must be at least 8 characters long');

    setConfirmModal({
      isOpen: true,
      title: 'Change Password?',
      message: 'Are you sure you want to change your password? You will need to use the new password for your next login.',
      type: 'danger',
      status: 'idle',
      onConfirm: executePasswordChange
    });
  };

  const executePasswordChange = async () => {
    setConfirmModal(prev => ({ ...prev, status: 'loading' }));

    try {
      await API.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      
      // ✅ Success Feedback inside Modal
      setConfirmModal(prev => ({ ...prev, status: 'success' }));
      
      // Auto close after 1.5 seconds
      setTimeout(() => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        toast.success('Password updated successfully!');
      }, 1500);

    } catch (error) {
      console.error('Password Error:', error);
      // ❌ Error Feedback inside Modal
      setConfirmModal(prev => ({ 
        ...prev, 
        status: 'error', 
        message: error.response?.data?.detail || 'Failed to change password. Please check your current password.'
      }));
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
  };

  const getAvatarSrc = () => {
    if (previewImage) return previewImage;
    if (profileData.avatar_url) {
        const src = profileData.avatar_url.startsWith('http') 
            ? profileData.avatar_url 
            : `${API_URL}${profileData.avatar_url}`;
        return `${src}?t=${imgVersion}`;
    }
    return null;
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm hover:bg-slate-50 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Account Settings</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Manage your personal information and security.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sidebar Navigation */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-2">
              <nav className="space-y-1">
                {[
                  { id: 'profile', label: 'My Profile', icon: User },
                  { id: 'security', label: 'Login & Security', icon: Shield },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeTab === item.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    {item.label}
                  </button>
                ))}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                >
                    <LogOut className="w-5 h-5" /> Logout
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
              
              {activeTab === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Avatar Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                    <div className="relative group">
                        <div className="w-28 h-28 rounded-full ring-4 ring-slate-50 dark:ring-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-lg">
                            {getAvatarSrc() ? (
                                <img src={getAvatarSrc()} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                                    {profileData.full_name?.charAt(0).toUpperCase() || 'U'}
                                </span>
                            )}
                        </div>
                        <button 
                            onClick={() => fileInputRef.current.click()}
                            className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-md transition-all transform group-hover:scale-110"
                        >
                            <Camera className="w-4 h-4" />
                        </button>
                        <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} accept="image/*" />
                    </div>
                    <div className="text-center sm:text-left flex-1">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{profileData.full_name}</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-3">{profileData.email}</p>
                        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                            <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 uppercase tracking-wide">
                                {profileData.role}
                            </span>
                            <span className="px-2.5 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium border border-green-200 dark:border-green-800/50">
                                Active Status
                            </span>
                        </div>
                    </div>
                  </div>

                  {/* Form Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Personal Information</h3>
                    </div>
                    
                    <form onSubmit={handleProfileSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Full Name</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                value={profileData.full_name || ''}
                                onChange={e => setProfileData({...profileData, full_name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Username</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                value={profileData.username || ''}
                                onChange={e => setProfileData({...profileData, username: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                value={profileData.email || ''}
                                onChange={e => setProfileData({...profileData, email: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phone</label>
                            <input 
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                                value={profileData.phone || ''}
                                onChange={e => setProfileData({...profileData, phone: e.target.value})}
                                placeholder="+1 (555) 000-0000"
                            />
                        </div>

                        <div className="md:col-span-2 pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800 mt-2">
                            <button 
                                type="button" 
                                onClick={() => setProfileData(originalProfileData)}
                                className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg font-medium text-sm transition-colors"
                            >
                                Discard
                            </button>
                            <button 
                                type="submit"
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Save Changes
                            </button>
                        </div>
                    </form>
                  </div>
                </motion.div>
              )}

              {/* SECURITY TAB */}
              {activeTab === 'security' && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                   <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 sm:p-8">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <Lock className="w-5 h-5 text-indigo-500" /> Change Password
                        </h3>
                        
                        <form onSubmit={handlePasswordChange} className="max-w-lg space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Current Password</label>
                                <div className="relative">
                                    <input 
                                        type={showPassword.current ? "text" : "password"}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all pr-10"
                                        value={passwordData.current_password}
                                        onChange={e => setPasswordData({...passwordData, current_password: e.target.value})}
                                    />
                                    <button type="button" onClick={() => setShowPassword({...showPassword, current: !showPassword.current})} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                                        {showPassword.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">New Password</label>
                                    <div className="relative">
                                        <input 
                                            type={showPassword.new ? "text" : "password"}
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all pr-10"
                                            value={passwordData.new_password}
                                            onChange={e => setPasswordData({...passwordData, new_password: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
                                    <div className="relative">
                                        <input 
                                            type={showPassword.confirm ? "text" : "password"}
                                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all pr-10"
                                            value={passwordData.confirm_password}
                                            onChange={e => setPasswordData({...passwordData, confirm_password: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button 
                                    type="submit"
                                    className="px-6 py-2.5 bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 text-white rounded-lg font-medium text-sm shadow-lg transition-all flex items-center gap-2"
                                >
                                    <Shield className="w-4 h-4" />
                                    Update Password
                                </button>
                            </div>
                        </form>
                   </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <ConfirmationModal
            isOpen={confirmModal.isOpen}
            title={confirmModal.title}
            message={confirmModal.message}
            type={confirmModal.type}
            status={confirmModal.status}
            onConfirm={confirmModal.onConfirm}
            onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            isLoading={confirmModal.status === 'loading'}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountSettings;