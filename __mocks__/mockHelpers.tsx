import React from 'react';

/**
 * Standardized mock component patterns for testing
 */

// Helper to create a simple mock component
export const createMockComponent = (componentName: string, defaultTestId?: string) => {
  const Component = React.forwardRef<any, any>(({ children, ...props }, ref) => (
    <div ref={ref} data-testid={defaultTestId || componentName.toLowerCase()} {...props}>
      {children}
    </div>
  ));
  Component.displayName = componentName;
  return Component;
};

// Helper to create a mock button component
export const createMockButton = (componentName: string, defaultTestId?: string) => {
  const Component = React.forwardRef<HTMLButtonElement, any>(({ children, onClick, ...props }, ref) => (
    <button 
      ref={ref} 
      onClick={onClick} 
      data-testid={defaultTestId || componentName.toLowerCase()} 
      {...props}
    >
      {children}
    </button>
  ));
  Component.displayName = componentName;
  return Component;
};

// Helper to create a mock input component
export const createMockInput = (componentName: string, defaultTestId?: string) => {
  const Component = React.forwardRef<HTMLInputElement, any>(({ onChange, ...props }, ref) => (
    <input 
      ref={ref}
      onChange={onChange} 
      data-testid={defaultTestId || componentName.toLowerCase()} 
      {...props} 
    />
  ));
  Component.displayName = componentName;
  return Component;
};

// Helper for components that need to maintain state
export const createStatefulMockComponent = (
  componentName: string, 
  renderFn: (props: any, state: any, setState: any, ref: any) => React.ReactElement
) => {
  const Component = React.forwardRef<any, any>((props, ref) => {
    const [state, setState] = React.useState({});
    return renderFn(props, state, setState, ref);
  });
  Component.displayName = componentName;
  return Component;
};