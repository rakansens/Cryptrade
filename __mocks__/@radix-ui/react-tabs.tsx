import React from 'react';

export const Root = ({ children, value, onValueChange, defaultValue }: any) => {
  const [activeValue, setActiveValue] = React.useState(value || defaultValue || '');

  React.useEffect(() => {
    if (value !== undefined) {
      setActiveValue(value);
    }
  }, [value]);

  const handleValueChange = (newValue: string) => {
    setActiveValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <div data-testid="tabs-root" data-value={activeValue}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, {
            value: activeValue,
            onValueChange: handleValueChange
          });
        }
        return child;
      })}
    </div>
  );
};

export const List = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => (
    <div ref={ref} role="tablist" data-testid="tabs-list" {...props}>
      {children}
    </div>
  )
);
List.displayName = 'TabsList';

export const Trigger = React.forwardRef<HTMLButtonElement, any>(
  ({ children, value: triggerValue, asChild, ...props }, ref) => {
    const handleClick = () => {
      const root = (ref as any)?.current?.closest('[data-testid="tabs-root"]');
      if (root && props.onValueChange) {
        props.onValueChange(triggerValue);
      }
    };

    const triggerProps = {
      ...props,
      ref,
      role: 'tab',
      'data-testid': `tab-${triggerValue}`,
      'data-state': props.value === triggerValue ? 'active' : 'inactive',
      'aria-selected': props.value === triggerValue,
      onClick: handleClick
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, triggerProps);
    }

    return <button type="button" {...triggerProps}>{children}</button>;
  }
);
Trigger.displayName = 'TabsTrigger';

export const Content = React.forwardRef<HTMLDivElement, any>(
  ({ children, value: contentValue, ...props }, ref) => {
    const isActive = props.value === contentValue;
    
    if (!isActive) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        data-testid={`tab-content-${contentValue}`}
        data-state={isActive ? 'active' : 'inactive'}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Content.displayName = 'TabsContent';