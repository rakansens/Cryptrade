import React from 'react';

export const Root = ({ children, value, onValueChange, open, onOpenChange }: any) => {
  const [isOpen, setIsOpen] = React.useState(open ?? false);

  React.useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const contextValue = {
    value,
    onValueChange,
    open: isOpen,
    onOpenChange: (newOpen: boolean) => {
      setIsOpen(newOpen);
      onOpenChange?.(newOpen);
    }
  };

  return (
    <div data-testid="select-root" data-state={isOpen ? 'open' : 'closed'}>
      {typeof children === 'function' ? children(contextValue) : children}
    </div>
  );
};

export const Trigger = React.forwardRef<HTMLButtonElement, any>(
  ({ children, asChild, ...props }, ref) => {
    const triggerProps = {
      ...props,
      ref,
      'data-testid': props['data-testid'] || 'select-trigger',
      'data-state': props['data-state'] || 'closed',
      'data-open': props['data-open'] || 'false',
      'aria-expanded': props['aria-expanded'] || false,
      onClick: (e: React.MouseEvent) => {
        props.onClick?.(e);
        // Simulate opening the select
        const root = e.currentTarget.closest('[data-testid="select-root"]');
        if (root) {
          root.setAttribute('data-state', 'open');
          e.currentTarget.setAttribute('data-state', 'open');
          e.currentTarget.setAttribute('data-open', 'true');
          e.currentTarget.setAttribute('aria-expanded', 'true');
        }
      }
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, triggerProps);
    }

    return <button type="button" {...triggerProps}>{children}</button>;
  }
);
Trigger.displayName = 'SelectTrigger';

export const Value = ({ placeholder, children }: any) => (
  <span data-testid="select-value">{children || placeholder}</span>
);

export const Icon = ({ children }: any) => (
  <span data-testid="select-icon">{children}</span>
);

export const Portal = ({ children }: any) => children;

export const Content = React.forwardRef<HTMLDivElement, any>(
  ({ children, position = 'popper', ...props }, ref) => (
    <div 
      ref={ref}
      {...props}
      data-testid="select-content"
      style={{ position: 'absolute', ...props.style }}
    >
      {children}
    </div>
  )
);
Content.displayName = 'SelectContent';

export const Viewport = ({ children }: any) => (
  <div data-testid="select-viewport">{children}</div>
);

export const Item = React.forwardRef<HTMLDivElement, any>(
  ({ children, value, textValue, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      data-testid={`select-item-${value}`}
      data-value={value}
      onClick={() => props.onSelect?.(value)}
    >
      {children}
    </div>
  )
);
Item.displayName = 'SelectItem';

export const ItemText = ({ children }: any) => (
  <span data-testid="select-item-text">{children}</span>
);

export const ItemIndicator = ({ children }: any) => (
  <span data-testid="select-item-indicator">{children}</span>
);

export const ScrollUpButton = ({ children }: any) => (
  <button data-testid="select-scroll-up">{children}</button>
);

export const ScrollDownButton = ({ children }: any) => (
  <button data-testid="select-scroll-down">{children}</button>
);

export const Group = ({ children }: any) => (
  <div data-testid="select-group">{children}</div>
);

export const Label = ({ children }: any) => (
  <div data-testid="select-label">{children}</div>
);

export const Separator = () => <hr data-testid="select-separator" />;