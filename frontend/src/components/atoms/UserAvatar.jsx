import React, { useState } from 'react';

export const UserAvatar = ({ user, size = 'md', className = '' }) => {
  const [imageError, setImageError] = useState(false);
  
  const API_URL = process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'http://localhost:8000';
  
  const getInitials = () => {
    if (!user) return 'U';
    const name = user.full_name || user.username || user.email || '';
    const parts = name.trim().split(' ').filter(Boolean);
    
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    } else if (parts.length === 1 && parts[0]) {
      return parts[0][0].toUpperCase();
    }
    return 'U';
  };

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-24 h-24 text-3xl'
  };

  const getAvatarUrl = () => {
    if (!user?.avatar_url) return null;
    if (user.avatar_url.startsWith('http')) return user.avatar_url;
    return `${API_URL}${user.avatar_url}`;
  };

  const avatarUrl = getAvatarUrl();
  const initials = getInitials();
  const shouldShowImage = avatarUrl && !imageError;

  return (
    <div 
      className={`
        ${sizeClasses[size]} 
        rounded-full 
        flex items-center justify-center 
        bg-indigo-100 dark:bg-indigo-900
        text-indigo-600 dark:text-indigo-300
        font-bold
        overflow-hidden
        border border-slate-200 dark:border-slate-700
        flex-shrink-0
        ${className}
      `}
    >
      {shouldShowImage ? (
        <img
          src={avatarUrl}
          alt={user?.full_name || user?.username || 'User'}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="select-none">{initials}</span>
      )}
    </div>
  );
};

export default UserAvatar;