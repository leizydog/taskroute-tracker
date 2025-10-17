export const Button = ({ 
    children, 
    variant = 'primary', 
    size = 'md', 
    onClick, 
    disabled = false, 
    icon: Icon,
    className = '',
    fullWidth = false,
    type = 'button'
  }) => {
    const variants = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700',
      secondary: 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600',
      danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700',
      success: 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700',
      ghost: 'bg-transparent border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
    };
    const sizes_btn = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg'
    };
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center gap-2 rounded-lg font-medium transition-colors ${variants[variant]} ${sizes_btn[size]} disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? 'w-full justify-center' : ''} ${className}`}
      >
        {Icon && <Icon className="w-4 h-4" />}
        {children}
      </button>
    );
  };