import React from 'react';

export const Switch = React.forwardRef<HTMLButtonElement, any>(
  ({ checked, defaultChecked, onCheckedChange, disabled, className, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState(checked ?? defaultChecked ?? false);
    
    React.useEffect(() => {
      if (checked !== undefined) {
        setIsChecked(checked);
      }
    }, [checked]);
    
    const handleClick = () => {
      if (disabled) return;
      
      const newChecked = !isChecked;
      if (checked === undefined) {
        setIsChecked(newChecked);
      }
      onCheckedChange?.(newChecked);
    };
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleClick();
      }
    };
    
    const defaultClasses = `
      peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent
      transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
      focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50
      data-[state=checked]:bg-primary data-[state=unchecked]:bg-input
    `.trim();
    
    const combinedClassName = `${defaultClasses} ${className || ''}`.trim();
    
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isChecked}
        data-state={isChecked ? 'checked' : 'unchecked'}
        disabled={disabled}
        className={combinedClassName}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-testid="switch"
        {...props}
      >
        <span
          className={`
            pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0
            transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0
            ${isChecked ? 'translate-x-5' : 'translate-x-0'}
          `.trim()}
          data-state={isChecked ? 'checked' : 'unchecked'}
        />
      </button>
    );
  }
);
Switch.displayName = 'Switch';