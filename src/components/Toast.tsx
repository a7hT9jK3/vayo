import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  toast: (message: string, type?: ToastType, duration?: number) => void; // Alias for flexibility
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, toast: showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-5 left-5 right-5 sm:left-auto sm:right-5 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full mx-auto sm:mx-0">
        <AnimatePresence>
          {toasts.map((toast) => {
            let bgColor = 'bg-white';
            let textColor = 'text-gray-800';
            let iconColor = 'text-gray-500';
            let Icon = Info;

            if (toast.type === 'success') {
              bgColor = 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50';
              textColor = 'text-emerald-800 dark:text-emerald-200';
              iconColor = 'text-emerald-500';
              Icon = CheckCircle2;
            } else if (toast.type === 'error') {
              bgColor = 'bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50';
              textColor = 'text-rose-800 dark:text-rose-200';
              iconColor = 'text-rose-500';
              Icon = AlertCircle;
            } else if (toast.type === 'warning') {
              bgColor = 'bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50';
              textColor = 'text-amber-800 dark:text-amber-200';
              iconColor = 'text-amber-500';
              Icon = AlertTriangle;
            } else {
              bgColor = 'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/30';
              textColor = 'text-blue-800 dark:text-blue-200';
              iconColor = 'text-blue-500';
              Icon = Info;
            }

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className={`${bgColor} shadow-lg rounded-2xl p-4 flex items-start gap-3 pointer-events-auto backdrop-blur-md`}
                style={{ direction: 'rtl' }}
              >
                <div className={`mt-0.5 ${iconColor} flex-shrink-0`}>
                  <Icon className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex-grow">
                  <p className={`text-sm font-medium ${textColor} leading-relaxed`}>
                    {toast.message}
                  </p>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors pointer-events-auto"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
