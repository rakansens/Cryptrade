import React from 'react';

export const Tabs = ({ children, value, onValueChange, defaultValue }: any) => {
  const [activeTab, setActiveTab] = React.useState(value || defaultValue || 'basic');
  
  React.useEffect(() => {
    if (value !== undefined) setActiveTab(value);
  }, [value]);
  
  const handleTabChange = (newValue: string) => {
    setActiveTab(newValue);
    onValueChange?.(newValue);
  };
  
  return (
    <div data-testid="tabs" data-value={activeTab}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, { activeTab, onTabChange: handleTabChange });
        }
        return child;
      })}
    </div>
  );
};

export const TabsList = ({ children, activeTab, onTabChange }: any) => (
  <div data-testid="tabs-list">
    {React.Children.map(children, child => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child as any, { activeTab, onTabChange });
      }
      return child;
    })}
  </div>
);

export const TabsTrigger = ({ children, value, activeTab, onTabChange }: any) => (
  <button 
    data-testid={`tab-${value}`}
    data-state={activeTab === value ? 'active' : 'inactive'}
    onClick={() => onTabChange?.(value)}
  >
    {children}
  </button>
);

export const TabsContent = ({ children, value, activeTab }: any) => (
  activeTab === value ? <div data-testid={`tab-content-${value}`}>{children}</div> : null
);