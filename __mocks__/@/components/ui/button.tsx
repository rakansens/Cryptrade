import React from 'react';

// Mock buttonVariants function to return className strings
export const buttonVariants = (props?: any) => {
  const variant = props?.variant || 'default';
  const size = props?.size || 'default';
  
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    success: 'bg-success text-success-foreground hover:bg-success/90',
    warning: 'bg-warning text-warning-foreground hover:bg-warning/90',
    error: 'bg-error text-error-foreground hover:bg-error/90',
    accentBlue: 'bg-accentBlue text-accentBlue-foreground hover:bg-accentBlue/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  };
  
  const sizeClasses = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10',
  };
  
  const baseClasses = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] active:shadow-inner';
  
  return `${baseClasses} ${variantClasses[variant] || ''} ${sizeClasses[size] || ''}`.trim();
};

export const Button = React.forwardRef<HTMLButtonElement, any>(
  ({ children, onClick, asChild, variant, size, className, ...props }, ref) => {
    const computedClassName = `${buttonVariants({ variant, size })} ${className || ''}`.trim();
    
    // Handle asChild prop for polymorphic component behavior
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as any, {
        ref,
        onClick,
        ...props,
        className: computedClassName
      });
    }
    
    return (
      <button ref={ref} onClick={onClick} data-testid="button" className={computedClassName} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';