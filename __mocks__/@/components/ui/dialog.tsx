import React from 'react';

// Create a context to share dialog state
const DialogContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {}
});

export const Dialog = ({ children, open, defaultOpen, onOpenChange }: any) => {
  const [isOpen, setIsOpenState] = React.useState(open ?? defaultOpen ?? false);
  
  React.useEffect(() => {
    if (open !== undefined) {
      setIsOpenState(open);
    }
  }, [open]);
  
  const setIsOpen = React.useCallback((newOpen: boolean) => {
    if (open === undefined) {
      setIsOpenState(newOpen);
    }
    onOpenChange?.(newOpen);
  }, [open, onOpenChange]);
  
  return (
    <DialogContext.Provider value={{ isOpen, setIsOpen }}>
      <div data-testid="dialog" data-open={isOpen}>
        {children}
      </div>
    </DialogContext.Provider>
  );
};

export const DialogTrigger = React.forwardRef<HTMLButtonElement, any>(
  ({ children, asChild, ...props }, ref) => {
    const { setIsOpen } = React.useContext(DialogContext);
    
    const handleClick = () => {
      setIsOpen(true);
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
      <button 
        ref={ref} 
        data-testid="dialog-trigger" 
        onClick={handleClick} 
        {...props}
      >
        {children}
      </button>
    );
  }
);
DialogTrigger.displayName = 'DialogTrigger';

export const DialogPortal = ({ children }: any) => {
  const { isOpen } = React.useContext(DialogContext);
  
  if (!isOpen) return null;
  
  return <>{children}</>;
};

export const DialogOverlay = React.forwardRef<HTMLDivElement, any>(
  ({ className, ...props }, ref) => {
    const { isOpen, setIsOpen } = React.useContext(DialogContext);
    
    if (!isOpen) return null;
    
    return (
      <div 
        ref={ref} 
        data-testid="dialog-overlay" 
        data-radix-dialog-overlay=""
        className={className}
        onClick={() => setIsOpen(false)}
        {...props} 
      />
    );
  }
);
DialogOverlay.displayName = 'DialogOverlay';

export const DialogContent = React.forwardRef<HTMLDivElement, any>(
  ({ children, className, ...props }, ref) => {
    const { isOpen, setIsOpen } = React.useContext(DialogContext);
    
    if (!isOpen) return null;
    
    return (
      <div 
        ref={ref} 
        data-testid="dialog-content" 
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        className={className}
        {...props}
      >
        {React.Children.map(children, child => {
          if (React.isValidElement(child) && child.type === DialogClose) {
            return React.cloneElement(child as any, { 
              onClick: () => setIsOpen(false) 
            });
          }
          return child;
        })}
      </div>
    );
  }
);
DialogContent.displayName = 'DialogContent';

export const DialogHeader = React.forwardRef<HTMLDivElement, any>(
  ({ children, className, ...props }, ref) => {
    const combinedClassName = `flex flex-col space-y-1.5 text-center sm:text-left ${className || ''}`.trim();
    
    return (
      <div 
        ref={ref} 
        data-testid="dialog-header" 
        className={combinedClassName}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DialogHeader.displayName = 'DialogHeader';

export const DialogFooter = React.forwardRef<HTMLDivElement, any>(
  ({ children, className, ...props }, ref) => {
    const combinedClassName = `flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ''}`.trim();
    
    return (
      <div 
        ref={ref} 
        data-testid="dialog-footer" 
        className={combinedClassName}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DialogFooter.displayName = 'DialogFooter';

export const DialogTitle = React.forwardRef<HTMLHeadingElement, any>(
  ({ children, className, ...props }, ref) => (
    <h2 
      ref={ref} 
      id="dialog-title"
      data-testid="dialog-title" 
      className={className}
      {...props}
    >
      {children}
    </h2>
  )
);
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<HTMLParagraphElement, any>(
  ({ children, className, ...props }, ref) => (
    <p 
      ref={ref} 
      id="dialog-description"
      data-testid="dialog-description" 
      className={className}
      {...props}
    >
      {children}
    </p>
  )
);
DialogDescription.displayName = 'DialogDescription';

export const DialogClose = React.forwardRef<HTMLButtonElement, any>(
  ({ children = 'Close', onClick, ...props }, ref) => {
    const { setIsOpen } = React.useContext(DialogContext);
    
    return (
      <button 
        ref={ref} 
        data-testid="dialog-close" 
        onClick={(e) => {
          onClick?.(e);
          setIsOpen(false);
        }}
        aria-label="Close"
        {...props}
      >
        {children}
      </button>
    );
  }
);
DialogClose.displayName = 'DialogClose';