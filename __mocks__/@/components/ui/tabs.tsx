import React from 'react';

// Create a context to share tab state
const TabsContext = React.createContext<{
  activeTab: string;
  onTabChange: (value: string) => void;
  orientation: 'horizontal' | 'vertical';
}>({
  activeTab: '',
  onTabChange: () => {},
  orientation: 'horizontal'
});

export const Tabs = React.forwardRef<HTMLDivElement, any>(
  ({ children, value, onValueChange, defaultValue, className, orientation = 'horizontal', ...props }, ref) => {
    const [activeTab, setActiveTab] = React.useState(value || defaultValue || '');
    
    React.useEffect(() => {
      if (value !== undefined) setActiveTab(value);
    }, [value]);
    
    const handleTabChange = (newValue: string) => {
      if (value === undefined) {
        setActiveTab(newValue);
      }
      onValueChange?.(newValue);
    };
    
    return (
      <TabsContext.Provider value={{ activeTab, onTabChange: handleTabChange, orientation }}>
        <div 
          ref={ref}
          className={className}
          data-testid="tabs" 
          data-orientation={orientation}
          {...props}
        >
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = 'Tabs';

export const TabsList = React.forwardRef<HTMLDivElement, any>(
  ({ children, className = '', ...props }, ref) => {
    const { orientation } = React.useContext(TabsContext);
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
        {children}
      </div>
    );
  }
);
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef<HTMLButtonElement, any>(
  ({ children, value, className, disabled, ...props }, ref) => {
    const { activeTab, onTabChange } = React.useContext(TabsContext);
    const isActive = activeTab === value;
    const baseClasses = 'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
    const stateClasses = isActive 
      ? 'bg-background text-foreground shadow-sm' 
      : 'text-muted-foreground';
    const combinedClassName = `${baseClasses} ${stateClasses} ${className || ''}`.trim();
    
    const handleClick = () => {
      if (!disabled) {
        onTabChange(value);
      }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;
      
      // Handle keyboard navigation
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const tabList = e.currentTarget.parentElement;
        if (!tabList) return;
        
        const tabs = Array.from(tabList.querySelectorAll('[role="tab"]:not([disabled])'));
        const currentIndex = tabs.indexOf(e.currentTarget);
        
        let nextIndex;
        if (e.key === 'ArrowRight') {
          nextIndex = currentIndex + 1 >= tabs.length ? 0 : currentIndex + 1;
        } else {
          nextIndex = currentIndex - 1 < 0 ? tabs.length - 1 : currentIndex - 1;
        }
        
        const nextTab = tabs[nextIndex] as HTMLElement;
        nextTab.focus();
        nextTab.click();
      }
    };
    
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
        data-disabled={disabled ? '' : undefined}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<HTMLDivElement, any>(
  ({ children, value, className, forceMount, ...props }, ref) => {
    const { activeTab } = React.useContext(TabsContext);
    const isActive = activeTab === value;
    
    // If forceMount is true, render even when inactive but hidden
    if (!isActive && !forceMount) return null;
    
    return (
      <div 
        ref={ref}
        role="tabpanel"
        id={`panel-${value}`}
        aria-labelledby={`trigger-${value}`}
        tabIndex={0}
        className={className}
        data-testid={`tab-content-${value}`}
        data-state={isActive ? 'active' : 'inactive'}
        style={!isActive && forceMount ? { display: 'none' } : undefined}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';