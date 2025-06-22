import React from 'react';

export const Card = React.forwardRef<HTMLDivElement, any>(
  ({ children, className = '', ...props }, ref) => {
    const defaultClasses = 'rounded-lg border bg-card text-card-foreground shadow-sm';
    const combinedClassName = `${defaultClasses} ${className}`.trim();
    
    return (
      <div ref={ref} className={combinedClassName} data-testid="card" {...props}>
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, any>(
  ({ children, className = '', ...props }, ref) => {
    const defaultClasses = 'flex flex-col space-y-1.5 p-6';
    const combinedClassName = `${defaultClasses} ${className}`.trim();
    
    return (
      <div ref={ref} className={combinedClassName} data-testid="card-header" {...props}>
        {children}
      </div>
    );
  }
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, any>(
  ({ children, className = '', ...props }, ref) => {
    const defaultClasses = 'text-2xl font-semibold leading-none tracking-tight';
    const combinedClassName = `${defaultClasses} ${className}`.trim();
    
    return (
      <h3 ref={ref} className={combinedClassName} data-testid="card-title" {...props}>
        {children}
      </h3>
    );
  }
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, any>(
  ({ children, className = '', ...props }, ref) => {
    const defaultClasses = 'text-sm text-muted-foreground';
    const combinedClassName = `${defaultClasses} ${className}`.trim();
    
    return (
      <p ref={ref} className={combinedClassName} data-testid="card-description" {...props}>
        {children}
      </p>
    );
  }
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, any>(
  ({ children, className = '', ...props }, ref) => {
    const defaultClasses = 'p-6 pt-0';
    const combinedClassName = `${defaultClasses} ${className}`.trim();
    
    return (
      <div ref={ref} className={combinedClassName} data-testid="card-content" {...props}>
        {children}
      </div>
    );
  }
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, any>(
  ({ children, className = '', ...props }, ref) => {
    const defaultClasses = 'flex items-center p-6 pt-0';
    const combinedClassName = `${defaultClasses} ${className}`.trim();
    
    return (
      <div ref={ref} className={combinedClassName} data-testid="card-footer" {...props}>
        {children}
      </div>
    );
  }
);
CardFooter.displayName = 'CardFooter';