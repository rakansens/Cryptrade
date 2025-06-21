import React from 'react';

export const Switch = React.forwardRef<HTMLButtonElement, any>(
  ({ checked, onCheckedChange, ...props }, ref) => (
    <button
      ref={ref}
      role="switch"
      aria-checked={checked}
      data-testid="switch"
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  )
);
Switch.displayName = 'Switch';