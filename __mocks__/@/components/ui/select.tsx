import React from 'react';

export const Select = ({ children, onValueChange }: any) => {
  // Store the onValueChange handler for testing
  (window as any).__selectOnValueChange = onValueChange;
  return <div data-testid="select">{children}</div>;
};

export const SelectTrigger = ({ children }: any) => (
  <button data-testid="select-trigger">{children}</button>
);

export const SelectContent = ({ children }: any) => (
  <div data-testid="select-content">{children}</div>
);

export const SelectItem = ({ children, value }: any) => (
  <button 
    data-testid={`select-item-${value}`} 
    onClick={() => (window as any).__selectOnValueChange?.(value)}
  >
    {children}
  </button>
);

export const SelectValue = () => <span data-testid="select-value" />;