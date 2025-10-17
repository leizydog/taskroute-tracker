// Badge Component
export const Badge = ({ text, color = 'indigo', size = 'sm' }) => {
    const colors = {
      indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    };
    const sizes = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
      lg: 'px-4 py-2 text-base'
    };
    return (
      <span className={`inline-flex rounded-full font-semibold ${colors[color]} ${sizes[size]}`}>
        {text}
      </span>
    );
  };
  
  // Button Component
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
  
  // Card Component
  export const Card = ({ children, className = '', hoverable = false }) => (
    <div className={`bg-white/90 dark:bg-slate-800/90 shadow-md rounded-xl p-6 ${hoverable ? 'hover:shadow-lg transition-shadow' : ''} ${className}`}>
      {children}
    </div>
  );
  
  // StatValue Component
  export const StatValue = ({ label, value, trend }) => (
    <div className="bg-white/90 dark:bg-slate-800/90 shadow-md rounded-xl p-6">
      <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{label}</p>
      {trend && (
        <p className={`text-xs mt-1 font-semibold ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </p>
      )}
    </div>
  );
  
  // Input Component
  export const Input = ({ label, type = 'text', placeholder, value, onChange, error, required = false }) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-2 border rounded-lg text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 transition-colors ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-slate-300 dark:border-slate-600 focus:ring-indigo-500'
        } focus:outline-none focus:ring-2`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
  
  // Select Component
  export const Select = ({ label, options, value, onChange, required = false }) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">-- Select --</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
  
  // Textarea Component
  export const Textarea = ({ label, placeholder, value, onChange, error, rows = 4, required = false }) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        rows={rows}
        className={`w-full px-4 py-2 border rounded-lg text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 transition-colors ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-slate-300 dark:border-slate-600 focus:ring-indigo-500'
        } focus:outline-none focus:ring-2`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
  
  // Modal Component
  export const Modal = ({ isOpen, title, children, onClose, footer }) => {
    if (!isOpen) return null;
  
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white/90 dark:bg-slate-800/90 shadow-md rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          <div className="mb-4">{children}</div>
          {footer && <div className="flex gap-2 justify-end">{footer}</div>}
        </div>
      </div>
    );
  };
  
  // ProgressBar Component
  export const ProgressBar = ({ value, color = 'indigo', showLabel = true }) => {
    const colors = {
      indigo: 'bg-indigo-500',
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
    };
  
    return (
      <div className="w-full">
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${colors[color]} transition-all duration-300`}
            style={{ width: `${Math.min(value, 100)}%` }}
          />
        </div>
        {showLabel && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{value}%</p>
        )}
      </div>
    );
  };
  
  // Avatar Component
  export const Avatar = ({ name, src, size = 'md' }) => {
    const sizes = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-16 h-16 text-lg',
    };
  
    const initials = name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  
    return (
      <div className={`${sizes[size]} rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-300`}>
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover rounded-full" />
        ) : (
          initials
        )}
      </div>
    );
  };
  
  // Spinner Component
  export const Spinner = ({ size = 'md' }) => {
    const sizes = {
      sm: 'w-4 h-4',
      md: 'w-8 h-8',
      lg: 'w-12 h-12',
    };
  
    return (
      <div className={`${sizes[size]} animate-spin rounded-full border-b-2 border-indigo-600`} />
    );
  };
  
  // Alert Component
  export const Alert = ({ type = 'info', title, message, onClose }) => {
    const types = {
      info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
      success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
      warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300',
      error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300',
    };
  
    return (
      <div className={`p-4 rounded-lg border ${types[type]} flex justify-between items-start`}>
        <div>
          {title && <p className="font-semibold">{title}</p>}
          {message && <p className="text-sm">{message}</p>}
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-2 font-bold">
            ✕
          </button>
        )}
      </div>
    );
  };