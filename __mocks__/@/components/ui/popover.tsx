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

export const PopoverTrigger = ({ children, asChild, isOpen, setIsOpen }: any) => {
  const handleClick = () => {
    setIsOpen?.(!isOpen);
  };
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, { 
      onClick: handleClick,
      'data-testid': 'popover-trigger'
    });
  }
  
  return (
    <button data-testid="popover-trigger" onClick={handleClick}>
      {children}
    </button>
  );
};

export const PopoverContent = ({ children, isOpen }: any) => {
  if (!isOpen) return null;
  return <div data-testid="popover-content">{children}</div>;
};