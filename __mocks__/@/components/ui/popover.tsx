import React from 'react';

export const Popover = ({ children, open, onOpenChange }: any) => {
  const [isOpen, setIsOpen] = React.useState(open || false);
  
  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);
  
  React.useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);
  
  return (
    <div data-testid="popover" data-open={isOpen}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, { isOpen, setIsOpen });
        }
        return child;
      })}
    </div>
  );
};

export const PopoverTrigger = React.forwardRef<HTMLButtonElement, any>(
  ({ children, asChild, isOpen, setIsOpen, ...props }, ref) => {
    const handleClick = () => {
      setIsOpen?.(!isOpen);
    };
    
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as any, { 
        ref,
        onClick: handleClick,
        'data-testid': 'popover-trigger',
        ...props
      });
    }
    
    return (
      <button ref={ref} data-testid="popover-trigger" onClick={handleClick} {...props}>
        {children}
      </button>
    );
  }
);
PopoverTrigger.displayName = 'PopoverTrigger';

export const PopoverContent = React.forwardRef<HTMLDivElement, any>(
  ({ children, isOpen, ...props }, ref) => {
    if (!isOpen) return null;
    return (
      <div ref={ref} data-testid="popover-content" {...props}>
        {children}
      </div>
    );
  }
);
PopoverContent.displayName = 'PopoverContent';