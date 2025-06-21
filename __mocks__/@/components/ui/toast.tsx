import React from 'react';

export const showToast = jest.fn();

// Mock toast components for testing
export const Toast = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="toast" {...props}>
      {children}
    </div>
  )
);
Toast.displayName = 'Toast';

export const ToastTitle = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="toast-title" {...props}>
      {children}
    </div>
  )
);
ToastTitle.displayName = 'ToastTitle';

export const ToastDescription = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="toast-description" {...props}>
      {children}
    </div>
  )
);
ToastDescription.displayName = 'ToastDescription';

export const ToastProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const ToastViewport = () => <div data-testid="toast-viewport" />;