'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ToastProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastItemProps extends ToastProps {
  onClose: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ 
  id, 
  message, 
  type, 
  duration = 4000,
  onClose 
}) => {
  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const typeStyles = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-yellow-600 text-white',
    info: 'bg-blue-600 text-white',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 rounded-lg shadow-lg transition-all duration-300 min-w-[300px] max-w-[500px]',
        typeStyles[type]
      )}
      role="alert"
    >
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => onClose(id)}
        className="ml-4 text-white hover:text-gray-200 focus:outline-none"
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = React.useCallback((toast: Omit<ToastProps, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  React.useEffect(() => {
    const handleToastEvent = (event: CustomEvent<Omit<ToastProps, 'id'>>) => {
      addToast(event.detail);
    };

    window.addEventListener('toast:show', handleToastEvent as EventListener);
    return () => {
      window.removeEventListener('toast:show', handleToastEvent as EventListener);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          {...toast}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

// Helper function to show toast
export const showToast = (message: string, type: ToastProps['type'], duration?: number) => {
  window.dispatchEvent(
    new CustomEvent('toast:show', {
      detail: { message, type, duration },
    })
  );
};