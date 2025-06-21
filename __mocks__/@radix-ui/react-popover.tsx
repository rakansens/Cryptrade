import React from 'react';

export const Root = ({ children, open, onOpenChange }: any) => {
  React.useEffect(() => {
    if (open !== undefined) {
      onOpenChange?.(open);
    }
  }, [open, onOpenChange]);
  return <>{children}</>;
};

export const Trigger = React.forwardRef<HTMLButtonElement, any>(
  ({ children, asChild, ...props }, ref) => {
    const triggerProps = {
      ...props,
      ref,
      'data-state': props['data-state'] || 'closed',
      'data-testid': props['data-testid'] || 'popover-trigger',
      onClick: (e: React.MouseEvent) => {
        props.onClick?.(e);
      }
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, triggerProps);
    }

    return <button {...triggerProps}>{children}</button>;
  }
);
Trigger.displayName = 'PopoverTrigger';

export const Portal = ({ children }: any) => children;

export const Content = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => (
    <div 
      ref={ref} 
      {...props}
      data-testid={props['data-testid'] || 'popover-content'}
      style={{ position: 'absolute', ...props.style }}
    >
      {children}
    </div>
  )
);
Content.displayName = 'PopoverContent';

export const Close = React.forwardRef<HTMLButtonElement, any>(
  ({ children, ...props }, ref) => (
    <button ref={ref} {...props}>
      {children}
    </button>
  )
);
Close.displayName = 'PopoverClose';

export const Anchor = ({ children }: any) => children;