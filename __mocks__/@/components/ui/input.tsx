import React from 'react';

export const Input = React.forwardRef<HTMLInputElement, any>(
  ({ className = '', type = 'text', disabled, onChange, ...props }, ref) => {
    const defaultClasses = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
    const combinedClassName = `${defaultClasses} ${className}`.trim();
    
    // Map type to role for accessibility
    const roleMap: Record<string, string> = {
      'text': 'textbox',
      'email': 'textbox',
      'password': 'textbox',
      'search': 'searchbox',
      'tel': 'textbox',
      'url': 'textbox',
      'number': 'spinbutton',
    };
    
    const role = roleMap[type] || undefined;
    
    return (
      <input 
        ref={ref} 
        type={type} 
        className={combinedClassName} 
        disabled={disabled}
        role={role}
        onChange={onChange}
        data-testid="input" 
        {...props} 
      />
    );
  }
);
Input.displayName = 'Input';