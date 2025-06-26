import React from 'react';

export const showToast = jest.fn();

// Mock toast components for testing
export const Toast = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) =>
    React.createElement('div', { ref, 'data-testid': 'toast', ...props }, children)
);
Toast.displayName = 'Toast';

export const ToastTitle = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) =>
    React.createElement('div', { ref, 'data-testid': 'toast-title', ...props }, children)
);
ToastTitle.displayName = 'ToastTitle';

export const ToastDescription = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) =>
    React.createElement('div', { ref, 'data-testid': 'toast-description', ...props }, children)
);
ToastDescription.displayName = 'ToastDescription';

export const ToastProvider = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.Fragment, {}, children);
export const ToastViewport = () =>
  React.createElement('div', { 'data-testid': 'toast-viewport' });