import React from 'react';

export const Dialog = ({ children, open, onOpenChange }: any) => {
  const [isOpen, setIsOpen] = React.useState(open || false);
  
  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);
  
  React.useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);
  
  return (
    <div data-testid="dialog" data-open={isOpen}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, { isOpen, setIsOpen });
        }
        return child;
      })}
    </div>
  );
};

export const DialogTrigger = React.forwardRef<HTMLButtonElement, any>(
  ({ children, asChild, isOpen, setIsOpen, ...props }, ref) => {
    const handleClick = () => {
      setIsOpen?.(!isOpen);
    };
    
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as any, { 
        ref,
        onClick: handleClick,
        'data-testid': 'dialog-trigger',
        ...props
      });
    }
    
    return (
      <button ref={ref} data-testid="dialog-trigger" onClick={handleClick} {...props}>
        {children}
      </button>
    );
  }
);
DialogTrigger.displayName = 'DialogTrigger';

export const DialogPortal = ({ children }: any) => children;

export const DialogOverlay = React.forwardRef<HTMLDivElement, any>(
  ({ isOpen, ...props }, ref) => {
    if (!isOpen) return null;
    return <div ref={ref} data-testid="dialog-overlay" {...props} />;
  }
);
DialogOverlay.displayName = 'DialogOverlay';

export const DialogContent = React.forwardRef<HTMLDivElement, any>(
  ({ children, isOpen, ...props }, ref) => {
    if (!isOpen) return null;
    return (
      <div ref={ref} data-testid="dialog-content" {...props}>
        {children}
      </div>
    );
  }
);
DialogContent.displayName = 'DialogContent';

export const DialogHeader = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="dialog-header" {...props}>
      {children}
    </div>
  )
);
DialogHeader.displayName = 'DialogHeader';

export const DialogFooter = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => (
    <div ref={ref} data-testid="dialog-footer" {...props}>
      {children}
    </div>
  )
);
DialogFooter.displayName = 'DialogFooter';

export const DialogTitle = React.forwardRef<HTMLHeadingElement, any>(
  ({ children, ...props }, ref) => (
    <h2 ref={ref} data-testid="dialog-title" {...props}>
      {children}
    </h2>
  )
);
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<HTMLParagraphElement, any>(
  ({ children, ...props }, ref) => (
    <p ref={ref} data-testid="dialog-description" {...props}>
      {children}
    </p>
  )
);
DialogDescription.displayName = 'DialogDescription';

export const DialogClose = React.forwardRef<HTMLButtonElement, any>(
  ({ children, setIsOpen, ...props }, ref) => (
    <button 
      ref={ref} 
      data-testid="dialog-close" 
      onClick={() => setIsOpen?.(false)}
      {...props}
    >
      {children}
    </button>
  )
);
DialogClose.displayName = 'DialogClose';