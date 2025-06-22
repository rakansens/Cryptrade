import React from 'react';

export const Tabs = React.forwardRef<HTMLDivElement, any>(
  ({ children, value, onValueChange, defaultValue, className, orientation = 'horizontal', ...props }, ref) => {
    const [activeTab, setActiveTab] = React.useState(value || defaultValue || 'basic');
    
    React.useEffect(() => {
      if (value !== undefined) setActiveTab(value);
    }, [value]);
    
    const handleTabChange = (newValue: string) => {
      setActiveTab(newValue);
      onValueChange?.(newValue);
    };
    
    // Don't pass internal state as DOM attributes
    const { 'data-value': _, ...restProps } = props;
    
    return (
      <div 
        ref={ref}
        className={className}
        data-testid="tabs" 
        data-orientation={orientation}
        {...restProps}
      >
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as any, { activeTab, onTabChange: handleTabChange, orientation });
          }
          return child;
        })}
      </div>
    );
  }
);
Tabs.displayName = 'Tabs';

export const TabsList = React.forwardRef<HTMLDivElement, any>(
  ({ children, activeTab, onTabChange, className = '', orientation = 'horizontal', ...props }, ref) => {
    const defaultClasses = 'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground';
    const combinedClassName = `${defaultClasses} ${className}`.trim();
    
    return (
      <div 
        ref={ref}
        role="tablist"
        className={combinedClassName}
        data-testid="tabs-list"
        aria-orientation={orientation}
        {...props}
      >
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as any, { activeTab, onTabChange });
          }
          return child;
        })}
      </div>
    );
  }
);
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef<HTMLButtonElement, any>(
  ({ children, value, activeTab, onTabChange, className, ...props }, ref) => {
    const isActive = activeTab === value;
    const defaultClasses = 'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
    const activeClasses = isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground';
    const combinedClassName = `${defaultClasses} ${activeClasses} ${className || ''}`.trim();
    
    return (
      <button 
        ref={ref}
        role="tab"
        aria-selected={isActive}
        aria-controls={`panel-${value}`}
        id={`trigger-${value}`}
        tabIndex={isActive ? 0 : -1}
        className={combinedClassName}
        data-testid={`tab-${value}`}
        data-state={isActive ? 'active' : 'inactive'}
        onClick={() => onTabChange?.(value)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<HTMLDivElement, any>(
  ({ children, value, activeTab, className, ...props }, ref) => {
    const isActive = activeTab === value;
    
    if (!isActive) return null;
    
    return (
      <div 
        ref={ref}
        role="tabpanel"
        id={`panel-${value}`}
        aria-labelledby={`trigger-${value}`}
        tabIndex={0}
        className={className}
        data-testid={`tab-content-${value}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';