import React from 'react';

const SelectContext = React.createContext<any>({});

export const Select = ({ children, value, defaultValue, onValueChange, disabled, name }: any) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState(value || defaultValue || '');
  
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
  
  return (
    <SelectContext.Provider value={{ 
      isOpen, 
      setIsOpen, 
      selectedValue, 
      onValueChange: handleValueChange,
      disabled,
      name 
    }}>
      <div data-testid="select">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger = React.forwardRef<HTMLButtonElement, any>(
  ({ children, className, ...props }, ref) => {
    const { isOpen, setIsOpen, disabled } = React.useContext(SelectContext);
    
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
        className={className}
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
  const items = React.useContext(SelectItemsContext) || {};
  
  return (
    <span data-testid="select-value">
      {selectedValue ? items[selectedValue] || selectedValue : placeholder}
    </span>
  );
};

// Context to store item labels
const SelectItemsContext = React.createContext<Record<string, string>>({});

export const SelectContent = ({ children, position, className, ...props }: any) => {
  const { isOpen } = React.useContext(SelectContext);
  const [items, setItems] = React.useState<Record<string, string>>({});
  
  if (!isOpen) return null;
  
  return (
    <SelectItemsContext.Provider value={items}>
      <div 
        data-testid="select-content"
        role="listbox"
        className={className}
        data-position={position}
        {...props}
      >
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as any, { setItems });
          }
          return child;
        })}
      </div>
    </SelectItemsContext.Provider>
  );
};

export const SelectItem = React.forwardRef<HTMLDivElement, any>(
  ({ children, value, disabled, setItems, ...props }, ref) => {
    const { selectedValue, onValueChange } = React.useContext(SelectContext);
    
    React.useEffect(() => {
      if (setItems && typeof children === 'string') {
        setItems((prev: any) => ({ ...prev, [value]: children }));
      }
    }, [value, children, setItems]);
    
    return (
      <div
        ref={ref}
        role="option"
        aria-selected={selectedValue === value}
        data-state={selectedValue === value ? 'checked' : 'unchecked'}
        data-disabled={disabled || undefined}
        data-testid={`select-item-${value}`}
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
  <div data-testid="select-group" role="group">{children}</div>
);

export const SelectLabel = ({ children }: any) => (
  <div data-testid="select-label" role="presentation">{children}</div>
);

export const SelectSeparator = () => <hr data-testid="select-separator" role="separator" />;

export const SelectScrollUpButton = ({ children }: any) => (
  <button data-testid="select-scroll-up" type="button">{children}</button>
);

export const SelectScrollDownButton = ({ children }: any) => (
  <button data-testid="select-scroll-down" type="button">{children}</button>
);