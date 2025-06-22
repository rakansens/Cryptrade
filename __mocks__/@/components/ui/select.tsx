import React from 'react';

const SelectContext = React.createContext<any>({});
const SelectItemsContext = React.createContext<Record<string, string>>({});

export const Select = ({ children, value, defaultValue, onValueChange, disabled, name }: any) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState(value || defaultValue || '');
  const [items, setItems] = React.useState<Record<string, string>>({});
  
  React.useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value);
    }
  }, [value]);
  
  const handleValueChange = (newValue: string) => {
    if (value === undefined) {
      setSelectedValue(newValue);
    }
    onValueChange?.(newValue);
    setIsOpen(false);
  };
  
  // Pre-populate items by traversing children
  React.useEffect(() => {
    const newItems: Record<string, string> = {};
    
    const traverse = (element: any): void => {
      React.Children.forEach(element, (child: any) => {
        if (!React.isValidElement(child)) return;
        
        if (child.type === SelectItem) {
          const { value, children } = child.props;
          if (value && typeof children === 'string') {
            newItems[value] = children;
          }
        } else if (child.props?.children) {
          traverse(child.props.children);
        }
      });
    };
    
    traverse(children);
    setItems(newItems);
  }, [children]);
  
  return (
    <SelectContext.Provider value={{ 
      isOpen, 
      setIsOpen, 
      selectedValue, 
      onValueChange: handleValueChange,
      disabled,
      name,
      setItems
    }}>
      <SelectItemsContext.Provider value={items}>
        <div data-testid="select">
          {children}
        </div>
      </SelectItemsContext.Provider>
    </SelectContext.Provider>
  );
};

export const SelectTrigger = React.forwardRef<HTMLButtonElement, any>(
  ({ children, className, ...props }, ref) => {
    const { isOpen, setIsOpen, disabled } = React.useContext(SelectContext);
    
    const defaultClasses = 'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1';
    const combinedClassName = `${defaultClasses} ${className || ''}`.trim();
    
    return (
      <button
        ref={ref}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        data-state={isOpen ? 'open' : 'closed'}
        data-testid="select-trigger"
        className={combinedClassName}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

export const SelectValue = ({ placeholder }: any) => {
  const { selectedValue } = React.useContext(SelectContext);
  const items = React.useContext(SelectItemsContext);
  
  return (
    <span data-testid="select-value">
      {selectedValue ? items[selectedValue] || selectedValue : placeholder}
    </span>
  );
};

export const SelectContent = ({ children, position = 'popper', className, ...props }: any) => {
  const { isOpen, setIsOpen } = React.useContext(SelectContext);
  
  React.useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, setIsOpen]);
  
  if (!isOpen) return null;
  
  const defaultClasses = 'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2';
  const positionClasses = position === 'popper' ? 'data-[position=popper]:translate-y-1 data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1' : '';
  const combinedClassName = `${defaultClasses} ${positionClasses} ${className || ''}`.trim();
  
  return (
    <div 
      data-testid="select-content"
      role="listbox"
      className={combinedClassName}
      data-position={position}
      data-state="open"
      {...props}
    >
      {children}
    </div>
  );
};

export const SelectItem = React.forwardRef<HTMLDivElement, any>(
  ({ children, value, disabled, className, ...props }, ref) => {
    const { selectedValue, onValueChange } = React.useContext(SelectContext);
    
    const defaultClasses = 'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';
    const combinedClassName = `${defaultClasses} ${className || ''}`.trim();
    
    return (
      <div
        ref={ref}
        role="option"
        aria-selected={selectedValue === value}
        data-state={selectedValue === value ? 'checked' : 'unchecked'}
        data-disabled={disabled || undefined}
        data-testid={`select-item-${value}`}
        className={combinedClassName}
        onClick={() => !disabled && onValueChange(value)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SelectItem.displayName = 'SelectItem';

export const SelectGroup = ({ children }: any) => (
  <div data-testid="select-group" role="group">
    {children}
  </div>
);

export const SelectLabel = ({ children }: any) => (
  <div data-testid="select-label" role="presentation">{children}</div>
);

export const SelectSeparator = () => <hr data-testid="select-separator" role="separator" />;

export const SelectScrollUpButton = ({ children }: any) => (
  <button data-testid="select-scroll-up" type="button" data-radix-select-viewport="">{children}</button>
);

export const SelectScrollDownButton = ({ children }: any) => (
  <button data-testid="select-scroll-down" type="button" data-radix-select-viewport="">{children}</button>
);

// Add Icon component for chevron
export const SelectIcon = ({ children }: any) => (
  <span data-testid="select-icon">{children}</span>
);