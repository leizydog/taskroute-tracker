import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const location = useLocation();

  const addToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const scheduleToast = (message, type = 'info', duration = 3000) => {
    sessionStorage.setItem('pendingToast', JSON.stringify({ message, type, duration }));
  };

  useEffect(() => {
    const pendingToast = sessionStorage.getItem('pendingToast');
    
    if (pendingToast) {
      try {
        const { message, type, duration } = JSON.parse(pendingToast);
        
        const timer = setTimeout(() => {
          addToast(message, type, duration);
          sessionStorage.removeItem('pendingToast');
        }, 400);

        return () => clearTimeout(timer);
      } catch (error) {
        console.error('Error parsing toast:', error);
        sessionStorage.removeItem('pendingToast');
      }
    }
  }, [location]);

  const toast = {
    success: (message, duration) => addToast(message, 'success', duration),
    error: (message, duration) => addToast(message, 'error', duration),
    info: (message, duration) => addToast(message, 'info', duration),
    warning: (message, duration) => addToast(message, 'warning', duration),
    
    successAfterNav: (message, duration) => scheduleToast(message, 'success', duration),
    errorAfterNav: (message, duration) => scheduleToast(message, 'error', duration),
    infoAfterNav: (message, duration) => scheduleToast(message, 'info', duration),
    warningAfterNav: (message, duration) => scheduleToast(message, 'warning', duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-3 pointer-events-none w-full max-w-md px-4">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const Toast = ({ toast, onRemove }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const duration = toast.duration;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 10);

    const timeout = setTimeout(() => {
      onRemove(toast.id);
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [toast.id, toast.duration, onRemove]);

  const config = {
    success: {
      icon: <CheckCircle className="w-5 h-5" />,
      className: "bg-white dark:bg-slate-800 border-green-500 text-slate-700 dark:text-white",
      progressColor: "bg-green-500",
      iconClass: "text-green-500"
    },
    error: {
      icon: <AlertCircle className="w-5 h-5" />,
      className: "bg-white dark:bg-slate-800 border-red-500 text-slate-700 dark:text-white",
      progressColor: "bg-red-500",
      iconClass: "text-red-500"
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5" />,
      className: "bg-white dark:bg-slate-800 border-yellow-500 text-slate-700 dark:text-white",
      progressColor: "bg-yellow-500",
      iconClass: "text-yellow-500"
    },
    info: {
      icon: <Info className="w-5 h-5" />,
      className: "bg-white dark:bg-slate-800 border-blue-500 text-slate-700 dark:text-white",
      progressColor: "bg-blue-500",
      iconClass: "text-blue-500"
    }
  };

  const style = config[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`relative pointer-events-auto flex w-full items-center gap-3 rounded-lg border-l-4 p-4 shadow-lg ${style.className}`}
    >
      <div className={`flex-shrink-0 ${style.iconClass}`}>
        {style.icon}
      </div>
      <p className="flex-1 text-sm font-medium">
        {toast.message}
      </p>
      
      <button onClick={() => onRemove(toast.id)} className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
        ✕
      </button>

      <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-b-lg overflow-hidden">
        <div 
          className={`h-full ${style.progressColor}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
};

export default ToastProvider;